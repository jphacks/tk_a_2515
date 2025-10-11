# FastAPI + Pydantic スキーマ設計テンプレート

このドキュメントは、FastAPIでCRUDエンドポイントを実装する際のPydanticスキーマのベストプラクティスとテンプレートです。

## ファイル構成

```
fastapi/
├── main.py                 # FastAPIアプリケーションのエントリーポイント
├── database.py             # データベース接続設定
├── models/                 # SQLAlchemy ORM モデル
│   ├── __init__.py
│   └── user.py
├── schemas/                # Pydantic スキーマ
│   ├── __init__.py
│   └── user.py
├── crud/                   # CRUD操作
│   ├── __init__.py
│   └── user.py
└── routers/                # APIエンドポイント
    ├── __init__.py
    └── users.py
```

## スキーマパターン

### 1. Base Schema（基底スキーマ）
共通のフィールドを定義します。

```python
class UserBase(BaseModel):
    """共通のユーザーフィールド"""
    email: EmailStr
    username: str = Field(..., min_length=3, max_length=50)
    is_active: bool = True
```

**用途**: 複数のスキーマで共有するフィールド

---

### 2. Create Schema（作成用スキーマ）
新規作成時に必要なフィールドを定義します。

```python
class UserCreate(UserBase):
    """ユーザー作成時のスキーマ"""
    password: str = Field(..., min_length=8, max_length=100)
```

**特徴**:
- 必須フィールドのみ
- IDや作成日時は含まない
- パスワードなどの機密情報を含む

**使用例**:
```python
@app.post("/users/", response_model=User)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    return crud.create_user(db, user)
```

---

### 3. Update Schema（更新用スキーマ）
更新時に使用するスキーマです。すべてのフィールドをオプショナルにします。

```python
class UserUpdate(BaseModel):
    """ユーザー更新時のスキーマ"""
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(None, min_length=3, max_length=50)
    password: Optional[str] = Field(None, min_length=8, max_length=100)
    is_active: Optional[bool] = None
```

**特徴**:
- すべてのフィールドが `Optional`
- 部分的な更新（PATCH）をサポート
- `model_dump(exclude_unset=True)` で未設定フィールドを除外

**使用例**:
```python
@app.patch("/users/{user_id}", response_model=User)
def update_user(user_id: int, user: UserUpdate, db: Session = Depends(get_db)):
    return crud.update_user(db, user_id, user)
```

---

### 4. InDB Schema（DB内部表現スキーマ）
データベース内部のフルデータを表現します。

```python
class UserInDB(UserBase):
    """データベース内部のユーザー表現"""
    id: int
    hashed_password: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

**特徴**:
- DB管理フィールド（ID、日時）を含む
- ハッシュ化されたパスワードを含む
- **外部に公開しない**（内部処理のみ）
- `from_attributes=True` でORMオブジェクトから変換

---

### 5. Response Schema（レスポンス用スキーマ）
API応答として外部に公開するスキーマです。

```python
class User(UserBase):
    """ユーザーのAPI応答スキーマ"""
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

**特徴**:
- 外部に公開して安全なフィールドのみ
- パスワード関連のフィールドは含まない
- `response_model` として使用

**使用例**:
```python
@app.get("/users/{user_id}", response_model=User)
def get_user(user_id: int, db: Session = Depends(get_db)):
    return crud.get_user(db, user_id)
```

---

### 6. List Response Schema（リスト応答用スキーマ）
一覧取得時のページネーション情報を含むスキーマです。

```python
class UserList(BaseModel):
    """ユーザーリスト応答スキーマ"""
    total: int
    skip: int
    limit: int
    items: list[User]
```

**使用例**:
```python
@app.get("/users/", response_model=UserList)
def list_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    users = crud.get_users(db, skip=skip, limit=limit)
    total = crud.count_users(db)
    return UserList(total=total, skip=skip, limit=limit, items=users)
```

---

## ベストプラクティス

### 1. セキュリティ
- ✅ パスワードは平文で返さない
- ✅ `UserInDB` は外部に公開しない
- ✅ 機密情報は `Response Schema` から除外
- ✅ `hashed_password` は API レスポンスに含めない

### 2. バリデーション
- ✅ `Field()` で制約を設定（`min_length`, `max_length` など）
- ✅ `EmailStr` でメールアドレスバリデーション
- ✅ カスタムバリデータを追加可能

```python
from pydantic import field_validator

class UserCreate(UserBase):
    password: str

    @field_validator('password')
    @classmethod
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError('Password must be at least 8 characters')
        return v
```

### 3. 柔軟な更新
- ✅ `Update` スキーマはすべて `Optional`
- ✅ 送信されたフィールドのみ更新
- ✅ `exclude_unset=True` で未設定を除外

```python
update_data = user_update.model_dump(exclude_unset=True)
for field, value in update_data.items():
    setattr(db_user, field, value)
```

### 4. 型安全性
- ✅ Pydantic で型チェック
- ✅ エディタの補完サポート
- ✅ ランタイムバリデーション

### 5. 継承構造の活用
```
UserBase          ← 共通フィールド
  ├─ UserCreate   ← + password（新規作成）
  ├─ UserInDB     ← + id, hashed_password, 日時（内部表現）
  └─ User         ← + id, 日時（公開用）

UserUpdate        ← すべてOptional（部分更新）
UserList          ← ページネーション情報
```

---

## 完全なCRUD実装例

### エンドポイント（routers/users.py）

```python
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session
import crud, schemas
from database import get_db

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", response_model=schemas.User, status_code=201)
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Create a new user"""
    return crud.create_user(db, user)

@router.get("/{user_id}", response_model=schemas.User)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Get user by ID"""
    return crud.get_user(db, user_id)

@router.get("/", response_model=schemas.UserList)
def list_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get list of users with pagination"""
    users = crud.get_users(db, skip=skip, limit=limit)
    total = crud.count_users(db)
    return schemas.UserList(total=total, skip=skip, limit=limit, items=users)

@router.patch("/{user_id}", response_model=schemas.User)
def update_user(user_id: int, user: schemas.UserUpdate, db: Session = Depends(get_db)):
    """Update user (partial update)"""
    return crud.update_user(db, user_id, user)

@router.delete("/{user_id}", status_code=204)
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """Delete user"""
    crud.delete_user(db, user_id)
```

### CRUD操作（crud/user.py）

```python
def update_user(db: Session, user_id: int, user_update: UserUpdate) -> User:
    """Update user information"""
    db_user = get_user(db, user_id)

    # 未設定のフィールドを除外
    update_data = user_update.model_dump(exclude_unset=True)

    # パスワードの更新処理
    if "password" in update_data:
        hashed_password = get_password_hash(update_data["password"])
        update_data["hashed_password"] = hashed_password
        del update_data["password"]

    # フィールドを更新
    for field, value in update_data.items():
        setattr(db_user, field, value)

    db.commit()
    db.refresh(db_user)
    return db_user
```

---

## 新しいリソースを追加する手順

1. **モデルを作成** (`models/resource.py`)
2. **スキーマを作成** (`schemas/resource.py`)
   - Base, Create, Update, InDB, Response, List
3. **CRUD関数を作成** (`crud/resource.py`)
   - create, get, list, update, delete
4. **ルーターを作成** (`routers/resources.py`)
   - POST, GET, PATCH, DELETE エンドポイント
5. **main.pyにルーターを登録**

```python
from routers import users_router
app.include_router(users_router)
```

---

## 追加の推奨事項

### エラーハンドリング
```python
from fastapi import HTTPException, status

if not user:
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"User with id {user_id} not found"
    )
```

### ページネーション
```python
@router.get("/", response_model=UserList)
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db)
):
    ...
```

### ソフトデリート
```python
class User(Base):
    deleted_at = Column(DateTime, nullable=True)

def soft_delete_user(db: Session, user_id: int):
    user = get_user(db, user_id)
    user.deleted_at = datetime.utcnow()
    db.commit()
```

---

このテンプレートを参考に、保守性が高く、型安全なFastAPI アプリケーションを構築してください！
