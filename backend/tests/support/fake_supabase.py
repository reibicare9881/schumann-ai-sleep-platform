"""In-memory stand-in for the Supabase client used by every REIBI router.

The production routers receive a ``supabase.Client`` and talk to PostgREST.  The
suite must never reach a real project, so this module implements the subset of
the query builder the backend actually uses (see ``.eq``/``.select``/``.order``
and friends).  Behaviour intentionally mirrors PostgREST where it matters for
authorization tests: filters compose, writes mutate the shared store, and a
missing row yields an empty ``data`` list rather than an exception.

Embedded selects such as ``identity:reibi_internal_users!fk(is_active)`` are not
joined.  Seed the parent row with the embedded key already populated when a test
needs one.
"""

from __future__ import annotations

import copy
import itertools
import re
from types import SimpleNamespace
from typing import Any, Callable, Iterable

_UNSET = object()


def _loose_equal(actual: Any, expected: Any) -> bool:
    """Compare the way PostgREST does, not the way Python does.

    A filter value arrives from the URL as text and is cast to the column type
    before comparison, so ``.eq("id", "501")`` matches an integer 501.  Keeping
    Python's stricter rules here would make tests fail for a reason the real
    database never produces.
    """
    if actual is None or expected is None:
        return actual is expected
    if isinstance(actual, bool) or isinstance(expected, bool):
        return actual is expected
    if type(actual) is type(expected):
        return actual == expected
    return str(actual) == str(expected)


def _matches(row: dict, key: str, expected: Any, comparator: Callable[[Any, Any], bool]) -> bool:
    try:
        return comparator(row.get(key), expected)
    except TypeError:
        return False


def _as_comparable(value: Any) -> Any:
    """Order rows the way PostgREST does without exploding on mixed types."""
    if value is None:
        return (0, "")
    if isinstance(value, bool):
        return (1, int(value))
    if isinstance(value, (int, float)):
        return (1, value)
    return (2, str(value))


_SIMPLE_COLUMN = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")


def _parse_projection(columns: tuple[str, ...]) -> tuple[str, ...] | None:
    """Return the columns to keep, or None when every column is returned.

    PostgREST projects to the requested columns; a fake that ignores the select
    list would hide a handler that leaks a field it never asked for.  Embedded
    resources (``profiles!inner(...)``, ``alias:table(...)``) and ``*`` are left
    alone so this stays a narrowing of behaviour, never a broadening.
    """
    requested: list[str] = []
    for chunk in columns:
        for part in str(chunk).split(","):
            name = part.strip()
            if not name:
                continue
            if name == "*" or "(" in name or ":" in name:
                return None
            if not _SIMPLE_COLUMN.match(name):
                return None
            requested.append(name)
    return tuple(requested) or None


class FakeQuery:
    """A chainable, PostgREST-shaped query over one in-memory table."""

    def __init__(self, store: "FakeSupabaseClient", table: str):
        self._store = store
        self._table = table
        self._filters: list[Callable[[dict], bool]] = []
        self._operation = "select"
        self._payload: Any = None
        self._order: list[tuple[str, bool]] = []
        self._limit: int | None = None
        self._range: tuple[int, int] | None = None
        self._single = False
        self._single_strict = False
        self._count_mode: str | None = None
        self._projection: tuple[str, ...] | None = None

    # ---- operations -----------------------------------------------------
    def select(self, *columns: str, count: str | None = None, **_kwargs: Any) -> "FakeQuery":
        if self._operation == "select":
            self._count_mode = count
            self._projection = _parse_projection(columns)
        return self

    def insert(self, payload: Any, **_kwargs: Any) -> "FakeQuery":
        self._operation = "insert"
        self._payload = payload
        return self

    def update(self, payload: dict, **_kwargs: Any) -> "FakeQuery":
        self._operation = "update"
        self._payload = payload
        return self

    def upsert(self, payload: Any, **_kwargs: Any) -> "FakeQuery":
        self._operation = "upsert"
        self._payload = payload
        return self

    def delete(self, **_kwargs: Any) -> "FakeQuery":
        self._operation = "delete"
        return self

    # ---- filters --------------------------------------------------------
    def eq(self, key: str, value: Any) -> "FakeQuery":
        self._filters.append(lambda row: _matches(row, key, value, _loose_equal))
        return self

    def neq(self, key: str, value: Any) -> "FakeQuery":
        self._filters.append(lambda row: _matches(row, key, value, lambda a, b: not _loose_equal(a, b)))
        return self

    def gt(self, key: str, value: Any) -> "FakeQuery":
        self._filters.append(lambda row: _matches(row, key, value, lambda a, b: a is not None and a > b))
        return self

    def gte(self, key: str, value: Any) -> "FakeQuery":
        self._filters.append(lambda row: _matches(row, key, value, lambda a, b: a is not None and a >= b))
        return self

    def lt(self, key: str, value: Any) -> "FakeQuery":
        self._filters.append(lambda row: _matches(row, key, value, lambda a, b: a is not None and a < b))
        return self

    def lte(self, key: str, value: Any) -> "FakeQuery":
        self._filters.append(lambda row: _matches(row, key, value, lambda a, b: a is not None and a <= b))
        return self

    def in_(self, key: str, values: Iterable[Any]) -> "FakeQuery":
        allowed = list(values)
        self._filters.append(
            lambda row: any(_loose_equal(row.get(key), candidate) for candidate in allowed)
        )
        return self

    def is_(self, key: str, value: Any) -> "FakeQuery":
        wants_null = value is None or str(value).lower() == "null"
        if wants_null:
            self._filters.append(lambda row: row.get(key) is None)
        else:
            expected = str(value).lower() == "true"
            self._filters.append(lambda row: bool(row.get(key)) is expected)
        return self

    def like(self, key: str, pattern: str) -> "FakeQuery":
        return self._pattern_filter(key, pattern, case_sensitive=True)

    def ilike(self, key: str, pattern: str) -> "FakeQuery":
        return self._pattern_filter(key, pattern, case_sensitive=False)

    def _pattern_filter(self, key: str, pattern: str, *, case_sensitive: bool) -> "FakeQuery":
        regex = re.compile(
            "^" + re.escape(str(pattern)).replace("%", ".*").replace("_", ".") + "$",
            0 if case_sensitive else re.IGNORECASE,
        )
        self._filters.append(lambda row: bool(regex.match(str(row.get(key) or ""))))
        return self

    @property
    def not_(self) -> "_NegatedFilters":
        """Support ``query.not_.is_("department", "null")`` as PostgREST does."""
        return _NegatedFilters(self)

    def or_(self, expression: str) -> "FakeQuery":
        """Support the ``col.op.value,col.op.value`` form used by the routers."""
        clauses: list[Callable[[dict], bool]] = []
        for raw in str(expression).split(","):
            parts = raw.split(".", 2)
            if len(parts) != 3:
                continue
            key, operator, value = parts
            clauses.append(self._clause(key, operator, value))
        self._filters.append(lambda row: any(clause(row) for clause in clauses))
        return self

    @staticmethod
    def _clause(key: str, operator: str, value: str) -> Callable[[dict], bool]:
        if operator == "eq":
            return lambda row: str(row.get(key)) == value
        if operator == "neq":
            return lambda row: str(row.get(key)) != value
        if operator == "is":
            return lambda row: row.get(key) is None if value == "null" else bool(row.get(key))
        if operator in {"like", "ilike"}:
            regex = re.compile(
                "^" + re.escape(value).replace("%", ".*").replace("_", ".") + "$",
                re.IGNORECASE if operator == "ilike" else 0,
            )
            return lambda row: bool(regex.match(str(row.get(key) or "")))
        return lambda row: False

    # ---- shaping --------------------------------------------------------
    def order(self, key: str, *, desc: bool = False, **_kwargs: Any) -> "FakeQuery":
        self._order.append((key, desc))
        return self

    def limit(self, value: int) -> "FakeQuery":
        self._limit = value
        return self

    def range(self, start: int, end: int) -> "FakeQuery":
        self._range = (start, end)
        return self

    def single(self) -> "FakeQuery":
        self._single = True
        self._single_strict = True
        return self

    def maybe_single(self) -> "FakeQuery":
        self._single = True
        self._single_strict = False
        return self

    # ---- execution ------------------------------------------------------
    def _rows(self) -> list[dict]:
        return self._store.tables.setdefault(self._table, [])

    def _selected(self, rows: list[dict]) -> list[dict]:
        return [row for row in rows if all(check(row) for check in self._filters)]

    def execute(self) -> SimpleNamespace:
        self._store.calls.append((self._table, self._operation))
        rows = self._rows()

        if self._operation in {"insert", "upsert"}:
            payloads = self._payload if isinstance(self._payload, list) else [self._payload]
            written = []
            for payload in payloads:
                record = copy.deepcopy(dict(payload or {}))
                if record.get("id") is None:
                    record["id"] = self._store.next_id(self._table)
                existing = next((row for row in rows if row.get("id") == record.get("id")), None)
                if existing is not None and self._operation == "upsert":
                    existing.update(record)
                    written.append(existing)
                else:
                    rows.append(record)
                    written.append(record)
            data = copy.deepcopy(written)
        elif self._operation == "update":
            matched = self._selected(rows)
            for row in matched:
                row.update(copy.deepcopy(dict(self._payload or {})))
            data = copy.deepcopy(matched)
        elif self._operation == "delete":
            matched = self._selected(rows)
            remaining = [row for row in rows if row not in matched]
            rows[:] = remaining
            data = copy.deepcopy(matched)
        else:
            data = copy.deepcopy(self._selected(rows))
            if self._projection is not None:
                data = [
                    {key: row[key] for key in self._projection if key in row}
                    for row in data
                ]
            for key, desc in reversed(self._order):
                data.sort(key=lambda row: _as_comparable(row.get(key)), reverse=desc)
            if self._range is not None:
                start, end = self._range
                data = data[start : end + 1]
            if self._limit is not None:
                data = data[: self._limit]

        total = len(data)
        if self._single:
            if not data and self._single_strict:
                raise FakeSupabaseError("no rows returned for single()")
            return SimpleNamespace(data=data[0] if data else None, count=total)
        return SimpleNamespace(data=data, count=total)


class _NegatedFilters:
    """Applies the next filter call and stores its inverse on the parent query."""

    def __init__(self, query: FakeQuery):
        self._query = query

    def __getattr__(self, name: str) -> Callable[..., FakeQuery]:
        method = getattr(self._query, name)

        def negated(*args: Any, **kwargs: Any) -> FakeQuery:
            before = len(self._query._filters)
            method(*args, **kwargs)
            added = self._query._filters[before:]
            del self._query._filters[before:]
            self._query._filters.append(lambda row: not all(check(row) for check in added))
            return self._query

        return negated


class FakeSupabaseError(RuntimeError):
    """Raised for the few cases where PostgREST would return an error body."""


class FakeRpc:
    def __init__(self, store: "FakeSupabaseClient", name: str, params: dict | None):
        self._store = store
        self._name = name
        self._params = params or {}

    def execute(self) -> SimpleNamespace:
        self._store.rpc_calls.append((self._name, copy.deepcopy(self._params)))
        handler = self._store.rpc_handlers.get(self._name)
        if handler is None:
            raise FakeSupabaseError(f"unregistered rpc: {self._name}")
        return SimpleNamespace(data=handler(self._params), count=None)


class FakeStorageBucket:
    def __init__(self, store: "FakeSupabaseClient", bucket: str):
        self._store = store
        self._bucket = bucket

    def upload(self, path: str, file: Any, file_options: dict | None = None) -> dict:
        self._store.storage_objects[(self._bucket, path)] = file
        return {"path": path}

    def download(self, path: str) -> Any:
        try:
            return self._store.storage_objects[(self._bucket, path)]
        except KeyError as exc:  # pragma: no cover - defensive
            raise FakeSupabaseError(f"missing object: {path}") from exc

    def remove(self, paths: list[str]) -> list[dict]:
        for path in paths:
            self._store.storage_objects.pop((self._bucket, path), None)
        return [{"name": path} for path in paths]

    def create_signed_url(self, path: str, expires_in: int) -> dict:
        return {"signedURL": f"https://fake.storage.test/{self._bucket}/{path}?exp={expires_in}"}


class FakeStorage:
    def __init__(self, store: "FakeSupabaseClient"):
        self._store = store

    def from_(self, bucket: str) -> FakeStorageBucket:
        return FakeStorageBucket(self._store, bucket)


class FakeSupabaseClient:
    """Drop-in replacement for ``supabase.Client`` in tests.

    ``tables`` maps table name to a list of row dicts and is the single source
    of truth; mutate it directly to seed a scenario.
    """

    def __init__(self, tables: dict[str, list[dict]] | None = None):
        self.tables: dict[str, list[dict]] = {
            name: [copy.deepcopy(row) for row in rows] for name, rows in (tables or {}).items()
        }
        self.rpc_handlers: dict[str, Callable[[dict], Any]] = {}
        self.calls: list[tuple[str, str]] = []
        self.rpc_calls: list[tuple[str, dict]] = []
        self.storage_objects: dict[tuple[str, str], Any] = {}
        self.storage = FakeStorage(self)
        self._sequences: dict[str, itertools.count] = {}

    # ---- seeding helpers ------------------------------------------------
    def seed(self, table: str, rows: Iterable[dict]) -> None:
        self.tables.setdefault(table, []).extend(copy.deepcopy(row) for row in rows)

    def reset(self) -> None:
        self.tables.clear()
        self.rpc_handlers.clear()
        self.calls.clear()
        self.rpc_calls.clear()
        self.storage_objects.clear()
        self._sequences.clear()

    def register_rpc(self, name: str, handler: Callable[[dict], Any]) -> None:
        self.rpc_handlers[name] = handler

    def next_id(self, table: str) -> int:
        if table not in self._sequences:
            existing = [row.get("id") for row in self.tables.get(table, [])]
            highest = max((value for value in existing if isinstance(value, int)), default=0)
            self._sequences[table] = itertools.count(highest + 1)
        return next(self._sequences[table])

    # ---- client surface -------------------------------------------------
    def table(self, name: str) -> FakeQuery:
        self.tables.setdefault(name, [])
        return FakeQuery(self, name)

    def from_(self, name: str) -> FakeQuery:
        return self.table(name)

    def rpc(self, name: str, params: dict | None = None) -> FakeRpc:
        return FakeRpc(self, name, params)
