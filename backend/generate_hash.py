from passlib.context import CryptContext

# 建立 bcrypt 加密器
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# 假設你原本的密碼都是 1234
passwords_to_hash = {
    "成員密碼 (member_pin)": "cccc",
    "主管密碼 (dept_pin)": "bbbb",
    "管理員密碼 (admin_pin)": "aaaa"
}

print("=== 🔐 你的安全 Hash 密碼 ===")
for role, pwd in passwords_to_hash.items():
    hashed = pwd_context.hash(pwd)
    print(f"{role} (原密碼 {pwd}):\n{hashed}\n")