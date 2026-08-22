# Only needed to run ClamAV alongside the API. See docs/reibi-clamav-setup.md
# before pointing Railway at this instead of its default Railpack build —
# it changes the build/deploy pipeline for a service real users depend on.
FROM python:3.11-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    clamav clamav-daemon \
    && rm -rf /var/lib/apt/lists/* \
    # The Debian package ships clamd.conf with no socket enabled at all — it's
    # not a matter of uncommenting a line, one has to be added. Only the TCP
    # listener (used by upload_safety.py) is meant to be used, but clamd 1.4.3
    # still tries to bind its default local socket at /var/run/clamav even
    # with no LocalSocket directive present, so that path has to exist too —
    # confirmed by running this image locally, not just read from docs.
    && printf '\nTCPSocket 3310\nTCPAddr 0.0.0.0\n' >> /etc/clamav/clamd.conf \
    && mkdir -p /var/lib/clamav /var/run/clamav \
    && chown -R clamav:clamav /var/lib/clamav /var/run/clamav

ENV CLAMAV_HOST=127.0.0.1
ENV CLAMAV_PORT=3310

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/docker-entrypoint.sh"]
