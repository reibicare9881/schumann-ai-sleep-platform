from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
db_hash = "$2b$12$iotVZuuAr7ZL.aUSsoA8Verl0CHrLkD1eT/ffycMW6Xsp9w8qHIFm"

# 讓我們看看這個 Hash 到底藏了什麼密碼
print("測試 'aaaa' (正常):", pwd_context.verify("aaaa", db_hash))
print("測試 'aaaa ' (多一個空白):", pwd_context.verify("aaaa ", db_hash))
print("測試 'aaaa\\n' (多一個換行):", pwd_context.verify("aaaa\n", db_hash))