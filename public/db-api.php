<?php
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

$dataDir = __DIR__ . '/app_data';
if (!is_dir($dataDir)) {
    @mkdir($dataDir, 0755, true);
}

// Protect app_data directory from direct web access
$htaccessFile = $dataDir . '/.htaccess';
if (!file_exists($htaccessFile)) {
    @file_put_contents($htaccessFile, "Deny from all\n");
}

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!is_array($body) || empty($body['table']) || empty($body['action'])) {
    http_response_code(400);
    echo json_encode(['data' => null, 'error' => ['message' => 'Invalid database request']]);
    exit;
}

$table = preg_replace('/[^a-zA-Z0-9_]/', '', (string)$body['table']);
if ($table === '') {
    http_response_code(400);
    echo json_encode(['data' => null, 'error' => ['message' => 'Invalid table name']]);
    exit;
}

$filePath = $dataDir . '/' . $table . '.json';

function readTable($filePath) {
    if (!file_exists($filePath)) return [];
    $fp = @fopen($filePath, 'r');
    if (!$fp) return [];
    flock($fp, LOCK_SH);
    $content = stream_get_contents($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    $decoded = json_decode($content, true);
    return is_array($decoded) ? $decoded : [];
}

function writeTable($filePath, $rows) {
    $fp = @fopen($filePath, 'c+');
    if (!$fp) return false;
    flock($fp, LOCK_EX);
    ftruncate($fp, 0);
    rewind($fp);
    fwrite($fp, json_encode(array_values($rows), JSON_UNESCAPED_UNICODE));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);
    return true;
}

function matchesFilter($row, $filter) {
    $op = $filter['op'] ?? 'eq';
    $col = $filter['col'] ?? '';
    $val = $filter['val'] ?? null;
    $rowVal = array_key_exists($col, $row) ? $row[$col] : null;

    switch ($op) {
        case 'eq':
            return $rowVal == $val;
        case 'neq':
            return $rowVal != $val;
        case 'gt':
            return $rowVal > $val;
        case 'gte':
            return $rowVal >= $val;
        case 'lt':
            return $rowVal < $val;
        case 'lte':
            return $rowVal <= $val;
        case 'is':
            if ($val === null) return $rowVal === null;
            return $rowVal === $val;
        case 'in':
            return is_array($val) && in_array($rowVal, $val, false);
        case 'like':
        case 'ilike':
            $pattern = str_replace('%', '', (string)$val);
            if ($pattern === '') return true;
            return stripos((string)$rowVal, $pattern) !== false;
        case 'contains':
            if (is_array($rowVal) && is_array($val)) {
                foreach ($val as $v) {
                    if (!in_array($v, $rowVal, false)) return false;
                }
                return true;
            }
            return stripos(json_encode($rowVal), json_encode($val)) !== false;
        case 'or':
            $expr = (string)$val;
            $parts = explode(',', $expr);
            foreach ($parts as $part) {
                $segs = explode('.', trim($part), 3);
                if (count($segs) === 3) {
                    [$c, $o, $v] = $segs;
                    if (matchesFilter($row, ['col' => $c, 'op' => $o, 'val' => $v])) {
                        return true;
                    }
                }
            }
            return false;
        default:
            return true;
    }
}

function applyFilters($rows, $filters) {
    if (!is_array($filters) || count($filters) === 0) return $rows;
    return array_values(array_filter($rows, function ($row) use ($filters) {
        foreach ($filters as $f) {
            if (!matchesFilter($row, $f)) return false;
        }
        return true;
    }));
}

$action = $body['action'];
$filters = $body['filters'] ?? [];
$orders = $body['orders'] ?? [];
$limit = isset($body['limit']) ? (int)$body['limit'] : null;
$range = $body['range'] ?? null;
$single = !empty($body['single']);
$maybeSingle = !empty($body['maybeSingle']);
$head = !empty($body['head']);

$rows = readTable($filePath);

if ($action === 'select') {
    $filtered = applyFilters($rows, $filters);
    $totalCount = count($filtered);

    if (is_array($orders) && count($orders) > 0) {
        usort($filtered, function ($a, $b) use ($orders) {
            foreach ($orders as $ord) {
                $col = $ord['col'] ?? '';
                $asc = !isset($ord['ascending']) || $ord['ascending'];
                $va = $a[$col] ?? null;
                $vb = $b[$col] ?? null;
                if ($va == $vb) continue;
                $cmp = ($va < $vb) ? -1 : 1;
                return $asc ? $cmp : -$cmp;
            }
            return 0;
        });
    }

    if (is_array($range) && count($range) === 2) {
        $from = max(0, (int)$range[0]);
        $to = max($from, (int)$range[1]);
        $filtered = array_slice($filtered, $from, ($to - $from) + 1);
    } elseif ($limit !== null && $limit >= 0) {
        $filtered = array_slice($filtered, 0, $limit);
    }

    if ($head) {
        echo json_encode(['data' => null, 'count' => $totalCount, 'error' => null]);
        exit;
    }

    if ($single || $maybeSingle) {
        $item = count($filtered) > 0 ? $filtered[0] : null;
        echo json_encode(['data' => $item, 'count' => $totalCount, 'error' => null]);
        exit;
    }

    echo json_encode(['data' => $filtered, 'count' => $totalCount, 'error' => null]);
    exit;
}

if ($action === 'insert') {
    $payload = $body['payload'] ?? [];
    $items = (isset($payload[0]) && is_array($payload[0])) ? $payload : [$payload];
    $inserted = [];
    foreach ($items as $item) {
        if (!is_array($item)) continue;
        if (!isset($item['id']) || $item['id'] === '') {
            $item['id'] = uniqid($table . '_', true);
        }
        $rows[] = $item;
        $inserted[] = $item;
    }
    writeTable($filePath, $rows);
    $resData = ($single || $maybeSingle) ? ($inserted[0] ?? null) : $inserted;
    echo json_encode(['data' => $resData, 'error' => null]);
    exit;
}

if ($action === 'upsert') {
    $payload = $body['payload'] ?? [];
    $conflictKey = !empty($body['onConflict']) ? (string)$body['onConflict'] : 'id';
    $items = (isset($payload[0]) && is_array($payload[0])) ? $payload : [$payload];
    $upserted = [];

    foreach ($items as $item) {
        if (!is_array($item)) continue;
        if (!isset($item['id']) || $item['id'] === '') {
            $item['id'] = uniqid($table . '_', true);
        }
        $foundIdx = -1;
        if (isset($item[$conflictKey])) {
            foreach ($rows as $idx => $existing) {
                if (isset($existing[$conflictKey]) && $existing[$conflictKey] == $item[$conflictKey]) {
                    $foundIdx = $idx;
                    break;
                }
            }
        }
        if ($foundIdx >= 0) {
            $rows[$foundIdx] = array_merge($rows[$foundIdx], $item);
            $upserted[] = $rows[$foundIdx];
        } else {
            $rows[] = $item;
            $upserted[] = $item;
        }
    }
    writeTable($filePath, $rows);
    $resData = ($single || $maybeSingle) ? ($upserted[0] ?? null) : $upserted;
    echo json_encode(['data' => $resData, 'error' => null]);
    exit;
}

if ($action === 'update') {
    $payload = is_array($body['payload'] ?? null) ? $body['payload'] : [];
    $updated = [];
    foreach ($rows as $idx => $row) {
        $match = true;
        foreach ($filters as $f) {
            if (!matchesFilter($row, $f)) {
                $match = false;
                break;
            }
        }
        if ($match) {
            $rows[$idx] = array_merge($row, $payload);
            $updated[] = $rows[$idx];
        }
    }
    writeTable($filePath, $rows);
    $resData = ($single || $maybeSingle) ? ($updated[0] ?? null) : $updated;
    echo json_encode(['data' => $resData, 'error' => null]);
    exit;
}

if ($action === 'delete') {
    $remaining = [];
    $deleted = [];
    foreach ($rows as $row) {
        $match = true;
        foreach ($filters as $f) {
            if (!matchesFilter($row, $f)) {
                $match = false;
                break;
            }
        }
        if ($match) {
            $deleted[] = $row;
        } else {
            $remaining[] = $row;
        }
    }
    writeTable($filePath, $remaining);
    echo json_encode(['data' => $deleted, 'error' => null]);
    exit;
}

http_response_code(400);
echo json_encode(['data' => null, 'error' => ['message' => 'Unknown action']]);
