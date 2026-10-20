#!/usr/bin/env bash
# Makes the first admin account (or turns another account into an admin).
# Admins log in with email and password, so the account is created through the
# normal sign-up and then given the admin role.
#   ./create-admin.sh
# COMPOSE_ARGS passes extra options to docker compose (e.g. "-p name" for a second copy).
set -euo pipefail
cd "$(dirname "$0")"

read -rp "ชื่อ-นามสกุล: " name
read -rp "อีเมล (@silpakorn.edu): " email
email=$(printf '%s' "$email" | tr '[:upper:]' '[:lower:]')
if ! [[ "$email" =~ ^[a-z0-9._-]+@silpakorn\.edu$ ]]; then
  echo "อีเมลต้องเป็น @silpakorn.edu" >&2; exit 1
fi
read -rsp "รหัสผ่าน (อย่างน้อย 8 ตัว): " password; echo
if [[ ${#password} -lt 8 || "$password" == *'"'* || "$password" == *'\'* || "$name" == *'"'* || "$name" == *'\'* ]]; then
  echo "รหัสผ่านต้องยาวอย่างน้อย 8 ตัว และชื่อกับรหัสผ่านห้ามมี \" หรือ \\" >&2; exit 1
fi

# Sign up from inside the web container (it reaches the backend directly);
# an existing account just gets the error, then is promoted below.
docker compose ${COMPOSE_ARGS:-} exec -T web wget -qO- --header 'Content-Type: application/json' \
  --post-data "{\"name\":\"$name\",\"email\":\"$email\",\"password\":\"$password\"}" \
  http://backend:4000/api/auth/register >/dev/null 2>&1 || echo "(มีบัญชีนี้อยู่แล้ว จะเปลี่ยนเป็นแอดมิน)"

docker compose ${COMPOSE_ARGS:-} exec -T db sh -c "MYSQL_PWD=\"\$MYSQL_ROOT_PASSWORD\" mysql --default-character-set=utf8mb4 -uroot cpsu_etms -e \"UPDATE users SET role = 'admin', active = 1 WHERE email = '$email'; SELECT name, email, role FROM users WHERE email = '$email';\""
