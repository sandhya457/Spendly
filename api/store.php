<?php
declare(strict_types=1);

/**
 * Relational persistence for Spendly.
 * The client keeps its approachable JSON document format, while MySQL stores
 * each record in a dedicated, user-scoped table. All writes are transactional.
 */

/** Called only while a PDO transaction is active. */
function writeNormalized(PDO $pdo, int $userId, array $d): void {
  $q = $pdo->prepare('INSERT INTO user_profiles (user_id,phone,student_id,course,study_year,avatar)
    VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE phone=VALUES(phone), student_id=VALUES(student_id),
    course=VALUES(course), study_year=VALUES(study_year), avatar=VALUES(avatar)');
  $p = $d['profile'];
  $q->execute([$userId, $p['phone'], $p['studentId'], $p['course'], $p['year'], $p['avatar']]);

  // Remove dependents before categories to keep foreign keys valid.
  foreach (['expenses','incomes','saving_goals','category_budgets','categories'] as $table) {
    $q = $pdo->prepare("DELETE FROM $table WHERE user_id = ?");
    $q->execute([$userId]);
  }
  $q = $pdo->prepare('INSERT INTO categories(user_id,name,color,symbol) VALUES (?,?,?,?)');
  foreach ($d['categories'] as $category) $q->execute([$userId, $category['name'], $category['color'], $category['symbol']]);
  $q = $pdo->prepare('INSERT INTO expenses(user_id,id,transaction_date,category,description,amount) VALUES (?,?,?,?,?,?)');
  foreach ($d['expenses'] as $e) $q->execute([$userId,$e['id'],$e['date'],$e['category'],$e['description'],$e['amount']]);
  $q = $pdo->prepare('INSERT INTO incomes(user_id,id,transaction_date,source,amount) VALUES (?,?,?,?,?)');
  foreach ($d['incomes'] as $i) $q->execute([$userId,$i['id'],$i['date'],$i['source'],$i['amount']]);
  $q = $pdo->prepare('INSERT INTO saving_goals(user_id,id,title,target,saved,due_date) VALUES (?,?,?,?,?,?)');
  foreach ($d['goals'] as $g) $q->execute([$userId,$g['id'],$g['title'],$g['target'],$g['saved'],$g['due']]);
  $q = $pdo->prepare('INSERT INTO monthly_budgets(user_id,total_amount) VALUES (?,?) ON DUPLICATE KEY UPDATE total_amount=VALUES(total_amount)');
  $q->execute([$userId, $d['budget']['total']]);
  $q = $pdo->prepare('INSERT INTO category_budgets(user_id,category,amount) VALUES (?,?,?)');
  foreach ($d['budget']['categories'] as $cat=>$amount) $q->execute([$userId, $cat, $amount]);
  $q = $pdo->prepare('INSERT INTO finance_preferences(user_id,dark_mode,budget_alerts) VALUES (?,?,?)
    ON DUPLICATE KEY UPDATE dark_mode=VALUES(dark_mode),budget_alerts=VALUES(budget_alerts)');
  $q->execute([$userId, (int)$d['settings']['darkMode'], (int)$d['settings']['budgetAlerts']]);
}

/** Migrate existing JSON records once, without modifying their revision. */
function ensureNormalized(int $id): void {
  $pdo = db();
  $q = $pdo->prepare('SELECT user_id FROM user_profiles WHERE user_id = ?');
  $q->execute([$id]);
  if ($q->fetchColumn()) return;
  $pdo->beginTransaction();
  try {
    $lock = $pdo->prepare('SELECT payload FROM user_data WHERE user_id = ? FOR UPDATE');
    $lock->execute([$id]);
    $payload = $lock->fetchColumn();
    if ($payload === false) failure(500, 'Account record missing.');
    $q->execute([$id]);
    if (!$q->fetchColumn()) {
      $data = validatedState(json_decode((string)$payload, true, 512, JSON_THROW_ON_ERROR));
      writeNormalized($pdo, $id, $data);
    }
    $pdo->commit();
  } catch(Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
  }
}
function normalizedState(int $id): array {
  ensureNormalized($id);
  $pdo = db();
  $q = $pdo->prepare('SELECT version FROM user_data WHERE user_id = ?');
  $q->execute([$id]); $version=(int)$q->fetchColumn();
  $u = user($id);
  $q = $pdo->prepare('SELECT phone,student_id,course,study_year,avatar FROM user_profiles WHERE user_id = ?');
  $q->execute([$id]);$p = $q->fetch();
  $profile = [
    'name'=>$u['name'], 'email'=>$u['email'],
    'phone'=>$p['phone'] ?? '', 'studentId'=>$p['student_id'] ?? '',
    'course'=>$p['course'] ?? '', 'year'=>$p['study_year'] ?? '',
    'avatar'=>$p['avatar'] ?: 'assets/avatar.jpg'
  ];
  $q = $pdo->prepare('SELECT name,color,symbol FROM categories WHERE user_id = ? ORDER BY name');
  $q->execute([$id]);$cats = $q->fetchAll();
  $q = $pdo->prepare('SELECT id,transaction_date AS date,category,description,amount FROM expenses WHERE user_id = ? ORDER BY id');
  $q->execute([$id]);
  $expenses = array_map(static function($r){$r['id']=(int)$r['id'];$r['amount']=(float)$r['amount'];return $r;},$q->fetchAll());
  $q = $pdo->prepare('SELECT id,transaction_date AS date,source,amount FROM incomes WHERE user_id = ? ORDER BY id');
  $q->execute([$id]);
  $incomes = array_map(static function($r){$r['id']=(int)$r['id'];$r['amount']=(float)$r['amount'];return $r;},$q->fetchAll());
  $q = $pdo->prepare('SELECT id,title,target,saved,due_date AS due FROM saving_goals WHERE user_id = ? ORDER BY id');
  $q->execute([$id]);
  $goals = array_map(static function($r){$r['id']=(int)$r['id'];$r['target']=(float)$r['target'];$r['saved']=(float)$r['saved'];return $r;},$q->fetchAll());
  $q = $pdo->prepare('SELECT category,amount FROM category_budgets WHERE user_id = ?');
  $q->execute([$id]);$limits=[];
  foreach($q->fetchAll() as $r) $limits[$r['category']] = (float)$r['amount'];
  $q = $pdo->prepare('SELECT total_amount FROM monthly_budgets WHERE user_id = ?');
  $q->execute([$id]);$total = (float)$q->fetchColumn();
  $q = $pdo->prepare('SELECT dark_mode,budget_alerts FROM finance_preferences WHERE user_id = ?');
  $q->execute([$id]);$settings=$q->fetch();
  return [
    'version'=>$version,
    'data'=>[
      'profile'=>$profile, 'categories'=>$cats,
      'expenses'=>$expenses, 'incomes'=>$incomes, 'goals'=>$goals,
      'budget'=>['total'=>$total,'categories'=>$limits],
      'settings'=>['darkMode'=>(bool)($settings['dark_mode'] ?? false),
                  'budgetAlerts'=>(bool)($settings['budget_alerts'] ?? true)]
    ]
  ];
}
function saveNormalized(int $id, array $clean, int $expected): int {
  ensureNormalized($id);
  $pdo = db();$pdo->beginTransaction();
  try {
    $q=$pdo->prepare('SELECT version FROM user_data WHERE user_id = ? FOR UPDATE');
    $q->execute([$id]);$revision=(int)$q->fetchColumn();
    if ($revision !== $expected) {
      $pdo->rollBack();
      failure(409, 'Your data changed in another tab. Reload before saving.');
    }
    // A profile save does not authorize changing the account's login email.
    $q=$pdo->prepare('SELECT email FROM users WHERE id = ?');
    $q->execute([$id]);$clean['profile']['email']=(string)$q->fetchColumn();
    writeNormalized($pdo,$id,$clean);
    $q=$pdo->prepare('UPDATE user_data SET payload = ?, version = version+1 WHERE user_id = ? AND version = ?');
    $q->execute([json_encode($clean, JSON_THROW_ON_ERROR),$id,$expected]);
    if($q->rowCount()!==1) {
      $pdo->rollBack();
      failure(409, 'Revision conflict. Reload your account.');
    }
    $q=$pdo->prepare('UPDATE users SET name = ? WHERE id = ?');
    $q->execute([$clean['profile']['name'],$id]);
    $pdo->commit();
    return $expected + 1;
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
  }
}
