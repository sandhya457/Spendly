<?php
declare(strict_types=1);

/**
 * Spendly API — PHP 8.1+ / MySQL 8+ or MariaDB 10.5+.
 * All private resources are scoped to the authenticated session.
 * See SETUP.md before deploying. Never commit database credentials.
 */
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, private');
header('X-Content-Type-Options: nosniff');

$https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off');
session_name('spendly_sid');
session_set_cookie_params([
  'lifetime' => 0, 'path' => '/', 'secure' => $https,
  'httponly' => true, 'samesite' => 'Lax'
]);
session_start();
require_once __DIR__.'/store.php';
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));

function send(int $code, array $payload): never {
  http_response_code($code);
  echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
  exit;
}
function failure(int $code, string $message): never { send($code, ['error' => $message]); }
function db(): PDO {
  static $pdo = null;
  if ($pdo !== null) return $pdo;
  $host = getenv('SPENDLY_DB_HOST') ?: '127.0.0.1';
  $port = getenv('SPENDLY_DB_PORT') ?: '3306';
  $name = getenv('SPENDLY_DB_NAME') ?: 'spendly';
  $user = getenv('SPENDLY_DB_USER') ?: 'root';
  $pass = getenv('SPENDLY_DB_PASSWORD') ?: '';
  $pdo = new PDO(
    "mysql:host=$host;port=$port;dbname=$name;charset=utf8mb4", $user, $pass,
    [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
     PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
     PDO::ATTR_EMULATE_PREPARES => false]
  );
  return $pdo;
}
function body(): array {
  if ((int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 6000000) failure(413, 'Request is too large.');
  try {
    $value = json_decode(file_get_contents('php://input'), true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($value)) failure(400, 'A JSON object is required.');
    return $value;
  } catch (JsonException $e) { failure(400, 'Invalid JSON.'); }
}
function csrf(): void {
  $provided = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
  if (!is_string($provided) || !hash_equals($_SESSION['csrf'], $provided)) {
    failure(403, 'Security token invalid. Refresh the page and try again.');
  }
}
function auth(): int {
  $id = (int)($_SESSION['user_id'] ?? 0);
  if (!$id) failure(401, 'Please sign in.');
  return $id;
}
function textval(mixed $value, int $max): string {
  return trim(substr((string)($value ?? ''), 0, $max));
}
function defaults(string $name, string $email): array {
  $cats = [
    ['name'=>'Food','color'=>'#cf7047','symbol'=>'F'],
    ['name'=>'Transport','color'=>'#477b98','symbol'=>'T'],
    ['name'=>'Education','color'=>'#6c5ea6','symbol'=>'E'],
    ['name'=>'Entertainment','color'=>'#bb6a9a','symbol'=>'N'],
    ['name'=>'Health','color'=>'#398f82','symbol'=>'H'],
    ['name'=>'Other','color'=>'#818a99','symbol'=>'O']
  ];
  return [
    'profile'=>['name'=>$name,'email'=>$email,'phone'=>'','studentId'=>'','course'=>'','year'=>'1st Year','avatar'=>'assets/avatar.jpg'],
    'budget'=>['total'=>0,'categories'=>array_fill_keys(array_column($cats, 'name'), 0)],
    'expenses'=>[], 'incomes'=>[], 'goals'=>[], 'categories'=>$cats,
    'settings'=>['darkMode'=>false,'budgetAlerts'=>true]
  ];
}
function amount(mixed $value, bool $allowZero = true): float {
  if (!is_numeric($value) || !is_finite((float)$value)) failure(422, 'Invalid amount.');
  $v = (float)$value;
  if ($v < ($allowZero ? 0 : 0.01) || $v > 999999999) failure(422, 'Amount out of range.');
  return round($v, 2);
}
function dateval(mixed $value): string {
  $date = (string)$value;
  $dt = DateTimeImmutable::createFromFormat('!Y-m-d', $date);
  if (!$dt || $dt->format('Y-m-d') !== $date) failure(422, 'Invalid date.');
  return $date;
}
function validatedState(array $input): array {
  foreach (['profile','budget','expenses','incomes','goals','categories','settings'] as $key) {
    if (!array_key_exists($key, $input) || !is_array($input[$key])) failure(422, "Missing $key.");
  }
  $p = $input['profile'];
  $name = textval($p['name'] ?? '', 120);
  $email = strtolower(textval($p['email'] ?? '', 190));
  if (strlen($name) < 2 || !filter_var($email, FILTER_VALIDATE_EMAIL)) failure(422, 'Enter a valid name and email.');
  $avatar = (string)($p['avatar'] ?? 'assets/avatar.jpg');
  if ($avatar !== 'assets/avatar.jpg' && (!preg_match('/^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+\/=]+$/', $avatar) || strlen($avatar) > 500000)) failure(422, 'Profile image is not supported.');
  $profile = ['name'=>$name,'email'=>$email,'phone'=>textval($p['phone'] ?? '', 40),
    'studentId'=>textval($p['studentId'] ?? '', 60),'course'=>textval($p['course'] ?? '', 120),
    'year'=>textval($p['year'] ?? '', 30),'avatar'=>$avatar];
  $cats = []; $seen = [];
  if (!count($input['categories']) || count($input['categories']) > 40) failure(422, 'Keep between 1 and 40 categories.');
  foreach ($input['categories'] as $c) {
    if (!is_array($c)) failure(422, 'Invalid category.');
    $cat = textval($c['name'] ?? '', 50);
    $key = strtolower($cat);
    if (!$cat || isset($seen[$key])) failure(422, 'Duplicate or empty category.');
    $color = (string)($c['color'] ?? '');
    if (!preg_match('/^#[0-9a-fA-F]{6}$/', $color)) failure(422, 'Invalid category color.');
    $seen[$key] = true;
    $cats[] = ['name'=>$cat,'color'=>$color,'symbol'=>strtoupper(substr($cat, 0, 1))];
  }
  $expenses = [];
  if (count($input['expenses']) > 10000) failure(422, 'Too many expenses.');
  foreach ($input['expenses'] as $e) {
    if (!is_array($e)) failure(422, 'Invalid expense.');
    $cat = textval($e['category'] ?? '', 50);
    if (!isset($seen[strtolower($cat)])) failure(422, 'An expense uses a removed category.');
    $expenses[] = ['id'=>(int)($e['id'] ?? 0),'date'=>dateval($e['date'] ?? ''),
      'category'=>$cat,'description'=>textval($e['description'] ?? '', 250),
      'amount'=>amount($e['amount'] ?? null, false)];
  }
  $incomes = [];
  if (count($input['incomes']) > 10000) failure(422, 'Too many income entries.');
  foreach ($input['incomes'] as $i) {
    if (!is_array($i)) failure(422, 'Invalid income.');
    $incomes[] = ['id'=>(int)($i['id'] ?? 0),'date'=>dateval($i['date'] ?? ''),
      'source'=>textval($i['source'] ?? '', 150), 'amount'=>amount($i['amount'] ?? null, false)];
  }
  $goals = [];
  if (count($input['goals']) > 100) failure(422, 'Too many goals.');
  foreach ($input['goals'] as $g) {
    if (!is_array($g)) failure(422, 'Invalid goal.');
    $target = amount($g['target'] ?? null, false);
    $saved = amount($g['saved'] ?? 0);
    if ($saved > $target) failure(422, 'Goal savings exceed target.');
    $goals[] = ['id'=>(int)($g['id'] ?? 0),'title'=>textval($g['title'] ?? '', 100),
      'target'=>$target, 'saved'=>$saved,'due'=>dateval($g['due'] ?? '')];
  }
  $limits = [];
  foreach ($cats as $c) $limits[$c['name']] = amount($input['budget']['categories'][$c['name']] ?? 0);
  return [
    'profile'=>$profile,
    'budget'=>['total'=>amount($input['budget']['total'] ?? 0), 'categories'=>$limits],
    'expenses'=>$expenses,'incomes'=>$incomes,'goals'=>$goals,'categories'=>$cats,
    'settings'=>[
      'darkMode'=>(bool)($input['settings']['darkMode'] ?? false),
      'budgetAlerts'=>(bool)($input['settings']['budgetAlerts'] ?? true)
    ]
  ];
}
function user(int $id): array {
  $q = db()->prepare('SELECT id, name, email FROM users WHERE id = ?');
  $q->execute([$id]);
  $row = $q->fetch();
  if (!$row) {
    unset($_SESSION['user_id']);
    failure(401, 'Account no longer exists.');
  }
  return $row;
}
function state(int $id): array { return normalizedState($id); }

function validVaultId(mixed $value): int {
  $id = filter_var($value, FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]]);
  if ($id === false) failure(422, 'Invalid vault.');
  return (int)$id;
}
function vaultRows(int $id, bool $includeArchived = false, bool $allHistory = false): array {
  $sql = 'SELECT id, name, target_amount, current_balance, archived, created_at FROM vaults WHERE user_id = ?';
  if (!$includeArchived) $sql .= ' AND archived = 0';
  $q = db()->prepare($sql.' ORDER BY created_at DESC, id DESC');
  $q->execute([$id]);
  $rows = $q->fetchAll();
  $historySql = 'SELECT id, kind, amount, note, created_at FROM vault_transactions WHERE user_id = ? AND vault_id = ? ORDER BY created_at DESC, id DESC';
  if (!$allHistory) $historySql .= ' LIMIT 40';
  $history = db()->prepare($historySql);
  foreach ($rows as &$row) {
    $row['id'] = (int)$row['id'];
    $row['target_amount'] = (float)$row['target_amount'];
    $row['current_balance'] = (float)$row['current_balance'];
    $history->execute([$id, $row['id']]);
    $row['transactions'] = array_map(static function($t) {
      $t['id'] = (int)$t['id'];
      $t['amount'] = (float)$t['amount'];
      return $t;
    }, $history->fetchAll());
  }
  unset($row);
  return $rows;
}
function checkPassword(int $id, string $password): void {
  $q = db()->prepare('SELECT password_hash FROM users WHERE id = ?');
  $q->execute([$id]);
  $hash = $q->fetchColumn();
  if (!$hash || !password_verify($password, (string)$hash)) failure(401, 'Current password is incorrect.');
}

try {
  $action = (string)($_GET['action'] ?? '');
  $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
  if ($action === 'session' && $method === 'GET') {
    $id = (int)($_SESSION['user_id'] ?? 0);
    send(200, ['authenticated'=>$id > 0,
      'user'=>$id ? user($id) : null, 'csrf'=>$_SESSION['csrf']]);
  }
  if ($action === 'register' && $method === 'POST') {
    csrf(); $b = body();
    $name = textval($b['name'] ?? '', 120);
    $email = strtolower(textval($b['email'] ?? '', 190));
    $password = (string)($b['password'] ?? '');
    if (strlen($name) < 2 || !filter_var($email, FILTER_VALIDATE_EMAIL)) failure(422, 'Enter a valid name and email.');
    if (strlen($password) < 8 || strlen($password) > 200) failure(422, 'Password must contain at least 8 characters.');
    $pdo = db();
    $pdo->beginTransaction();
    try {
      $q = $pdo->prepare('INSERT INTO users (name,email,password_hash) VALUES (?,?,?)');
      $q->execute([$name,$email,password_hash($password, PASSWORD_DEFAULT)]);
      $id = (int)$pdo->lastInsertId();
      $q = $pdo->prepare('INSERT INTO user_data (user_id,payload) VALUES (?,?)');
      $q->execute([$id,json_encode(defaults($name,$email), JSON_THROW_ON_ERROR)]);
      $pdo->commit();
    } catch (PDOException $e) {
      $pdo->rollBack();
      if ($e->getCode() === '23000') failure(409, 'This email address already has an account.');
      throw $e;
    }
    session_regenerate_id(true);
    $_SESSION['user_id'] = $id;
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    send(201, ['ok'=>true]);
  }
  if ($action === 'login' && $method === 'POST') {
    csrf(); $b = body();
    $email = strtolower(textval($b['email'] ?? '', 190));
    $password = (string)($b['password'] ?? '');
    $until = (int)($_SESSION['login_block_until'] ?? 0);
    if ($until > time()) failure(429, 'Too many attempts. Try again in a minute.');
    $q = db()->prepare('SELECT id, password_hash FROM users WHERE email = ?');
    $q->execute([$email]); $r = $q->fetch();
    if (!$r || !password_verify($password, $r['password_hash'])) {
      $_SESSION['login_attempts'] = (int)($_SESSION['login_attempts'] ?? 0) + 1;
      if ($_SESSION['login_attempts'] >= 5) {
        $_SESSION['login_block_until'] = time() + 60;
        $_SESSION['login_attempts'] = 0;
      }
      failure(401, 'Incorrect email or password.');
    }
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int)$r['id'];
    $_SESSION['csrf'] = bin2hex(random_bytes(32));
    unset($_SESSION['login_attempts'], $_SESSION['login_block_until']);
    send(200, ['ok'=>true]);
  }
  if ($action === 'logout' && $method === 'POST') {
    csrf(); $_SESSION = []; session_destroy(); send(200, ['ok'=>true]);
  }
  $id = auth();
  if ($action === 'data' && $method === 'GET') send(200, state($id));
  if ($action === 'data' && $method === 'PUT') {
    csrf(); $b=body();
    if (!isset($b['data']) || !is_array($b['data']) || !isset($b['version']))
      failure(422, 'Missing data or revision.');
    $clean=validatedState($b['data']);
    $version=saveNormalized($id,$clean,(int)$b['version']);
    send(200,['ok'=>true,'version'=>$version]);
  }
  if ($action === 'change-password' && $method === 'POST') {
    csrf(); $b = body();
    $old = (string)($b['current'] ?? '');
    $new = (string)($b['password'] ?? '');
    if (strlen($new) < 8 || strlen($new) > 200) failure(422, 'New password must have at least 8 characters.');
    $q = db()->prepare('SELECT password_hash FROM users WHERE id = ?');
    $q->execute([$id]); $hash = $q->fetchColumn();
    if (!password_verify($old, $hash ?: '')) failure(401, 'Current password is incorrect.');
    $q = db()->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
    $q->execute([password_hash($new, PASSWORD_DEFAULT), $id]);
    send(200, ['ok'=>true]);
  }
  if ($action === 'reset-data' && $method === 'POST') {
    csrf();
    $q=db()->prepare('SELECT COUNT(*) FROM vaults WHERE user_id = ? AND archived = 0 AND current_balance > 0');
    $q->execute([$id]);
    if ((int)$q->fetchColumn() > 0)
      failure(409,'Withdraw all vault balances before resetting financial records.');
    $u=user($id);$current=state($id);
    saveNormalized($id,defaults($u['name'],$u['email']),(int)$current['version']);
    send(200,['ok'=>true]);
  }
  if ($action === 'change-email' && $method === 'POST') {
    csrf(); $b = body();
    $email = strtolower(textval($b['email'] ?? '', 190));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) failure(422, 'Enter a valid email address.');
    checkPassword($id, (string)($b['current'] ?? ''));
    $pdo = db(); $pdo->beginTransaction();
    try {
      // Lock in the same order as finance saves to avoid account-update deadlocks.
      $s = $pdo->prepare('SELECT payload FROM user_data WHERE user_id = ? FOR UPDATE');
      $s->execute([$id]); $raw = $s->fetchColumn();
      if ($raw === false) failure(500, 'Account data missing.');
      $payload = json_decode((string)$raw, true, 512, JSON_THROW_ON_ERROR);
      $payload['profile']['email'] = $email;
      $u = $pdo->prepare('UPDATE users SET email = ? WHERE id = ?');
      $u->execute([$email, $id]);
      $u = $pdo->prepare('UPDATE user_data SET payload = ?, version = version + 1 WHERE user_id = ?');
      $u->execute([json_encode($payload, JSON_THROW_ON_ERROR), $id]);
      $pdo->commit();
    } catch (PDOException $e) {
      if ($pdo->inTransaction()) $pdo->rollBack();
      if ($e->getCode() === '23000') failure(409, 'This email address is already registered.');
      throw $e;
    }
    send(200, ['ok'=>true, 'email'=>$email]);
  }
  if ($action === 'delete-account' && $method === 'POST') {
    csrf(); $b = body();
    if (($b['confirmation'] ?? '') !== 'DELETE') failure(422, 'Type DELETE to confirm.');
    checkPassword($id, (string)($b['current'] ?? ''));
    $q = db()->prepare('DELETE FROM users WHERE id = ?');
    $q->execute([$id]);
    $_SESSION = []; session_destroy();
    send(200, ['ok'=>true]);
  }
  if ($action === 'export-account' && $method === 'GET') {
    $account = user($id);
    send(200, ['exported_at'=>gmdate('c'), 'account'=>$account,
      'finance'=>state($id)['data'], 'vaults'=>vaultRows($id, true, true)]);
  }
  if ($action === 'vaults' && $method === 'GET') {
    send(200, ['vaults'=>vaultRows($id)]);
  }
  if ($action === 'vault-create' && $method === 'POST') {
    csrf(); $b = body();
    $name = textval($b['name'] ?? '', 80);
    if (strlen($name) < 2) failure(422, 'Enter a vault name.');
    $target = amount($b['target'] ?? 0);
    $q = db()->prepare('SELECT COUNT(*) FROM vaults WHERE user_id = ? AND archived = 0');
    $q->execute([$id]);
    if ((int)$q->fetchColumn() >= 12) failure(422, 'You can keep up to 12 active vaults.');
    $q = db()->prepare('INSERT INTO vaults(user_id, name, target_amount) VALUES(?,?,?)');
    $q->execute([$id, $name, $target]);
    send(201, ['ok'=>true, 'id'=>(int)db()->lastInsertId()]);
  }
  if ($action === 'vault-update' && $method === 'POST') {
    csrf(); $b = body();
    $vaultId = validVaultId($b['id'] ?? null);
    $name = textval($b['name'] ?? '', 80);
    if (strlen($name) < 2) failure(422, 'Enter a vault name.');
    $target = amount($b['target'] ?? 0);
    $q = db()->prepare('UPDATE vaults SET name = ?, target_amount = ? WHERE id = ? AND user_id = ? AND archived = 0');
    $q->execute([$name, $target, $vaultId, $id]);
    if ($q->rowCount() === 0) {
      $check = db()->prepare('SELECT id FROM vaults WHERE id = ? AND user_id = ? AND archived = 0');
      $check->execute([$vaultId,$id]);
      if (!$check->fetchColumn()) failure(404, 'Vault not found.');
    }
    send(200, ['ok'=>true]);
  }
  if ($action === 'vault-action' && $method === 'POST') {
    csrf(); $b = body();
    $vaultId = validVaultId($b['id'] ?? null);
    $kind = (string)($b['kind'] ?? '');
    if (!in_array($kind, ['deposit','withdraw'], true)) failure(422, 'Invalid vault action.');
    $value = amount($b['amount'] ?? null, false);
    $note = textval($b['note'] ?? '', 200);
    $pdo = db(); $pdo->beginTransaction();
    try {
      // A single account-level row lock serializes vault movements with finance saves.
      $lock = $pdo->prepare('SELECT payload FROM user_data WHERE user_id = ? FOR UPDATE');
      $lock->execute([$id]);
      $financialSnapshot = $lock->fetchColumn();
      if ($financialSnapshot === false) failure(500, 'Account data missing.');
      $q = $pdo->prepare('SELECT current_balance FROM vaults WHERE id = ? AND user_id = ? AND archived = 0 FOR UPDATE');
      $q->execute([$vaultId, $id]);
      $balance = $q->fetchColumn();
      if ($balance === false) { $pdo->rollBack(); failure(404, 'Vault not found.'); }
      $balanceCents = (int)round((float)$balance * 100);
      $cents = (int)round($value * 100);
      if ($kind === 'withdraw' && $balanceCents < $cents) {
        $pdo->rollBack(); failure(422, 'Insufficient vault balance.');
      }
      if ($kind === 'deposit') {
        $financial = json_decode((string)$financialSnapshot, true);
        $income = array_reduce($financial['incomes'] ?? [], static fn($sum,$x)=>$sum+(int)round((float)$x['amount']*100),0);
        $spent = array_reduce($financial['expenses'] ?? [], static fn($sum,$x)=>$sum+(int)round((float)$x['amount']*100),0);
        $q = $pdo->prepare('SELECT COALESCE(SUM(current_balance),0) FROM vaults WHERE user_id = ? AND archived = 0');
        $q->execute([$id]);
        $reserved = (int)round((float)$q->fetchColumn()*100);
        if ($cents > $income - $spent - $reserved) {
          $pdo->rollBack(); failure(422, 'Not enough unallocated funds. Record income before depositing.');
        }
      }
      $newBalance = ($balanceCents + ($kind === 'deposit' ? $cents : -$cents)) / 100;
      $q = $pdo->prepare('UPDATE vaults SET current_balance = ? WHERE id = ? AND user_id = ?');
      $q->execute([$newBalance, $vaultId, $id]);
      $q = $pdo->prepare('INSERT INTO vault_transactions (user_id,vault_id,kind,amount,note) VALUES (?,?,?,?,?)');
      $q->execute([$id, $vaultId, $kind, $value, $note]);
      $pdo->commit();
    } catch(Throwable $e) {
      if ($pdo->inTransaction()) $pdo->rollBack();
      throw $e;
    }
    send(200, ['ok'=>true, 'balance'=>$newBalance]);
  }
  if ($action === 'vault-archive' && $method === 'POST') {
    csrf(); $b = body();
    $vaultId = validVaultId($b['id'] ?? null);
    $q = db()->prepare('SELECT current_balance FROM vaults WHERE id = ? AND user_id = ? AND archived = 0');
    $q->execute([$vaultId, $id]); $value = $q->fetchColumn();
    if ($value === false) failure(404, 'Vault not found.');
    if ((float)$value > 0) failure(422, 'Withdraw the balance before archiving this vault.');
    $q = db()->prepare('UPDATE vaults SET archived = 1 WHERE id = ? AND user_id = ? AND current_balance = 0');
    $q->execute([$vaultId, $id]);
    send(200, ['ok'=>true]);
  }
  failure(404, 'Endpoint not found.');
} catch (PDOException $e) {
  error_log('Spendly DB error: '.$e->getMessage());
  failure(503, 'Database unavailable. Check the server setup.');
} catch (Throwable $e) {
  error_log('Spendly error: '.$e->getMessage());
  failure(500, 'Unexpected server error.');
}
