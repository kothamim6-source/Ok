<?php
header('Content-Type: application/json; charset=UTF-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

ini_set('display_errors', 0);
error_reporting(E_ALL);
@set_time_limit(25);

$supabaseUrl = getenv('VITE_SUPABASE_URL') ?: (getenv('SUPABASE_URL') ?: '');
$supabaseAnonKey = getenv('VITE_SUPABASE_ANON_KEY') ?: (getenv('SUPABASE_ANON_KEY') ?: '');

function httpGetJson($url, $headers = [], $retries = 3) {
    for ($attempt = 1; $attempt <= $retries; $attempt++) {
        $ch = curl_init($url);
        if (!$ch) return null;
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_TIMEOUT, 12);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_USERAGENT, 'Mozilla/5.0 (compatible; StreamHubDashboard/1.0)');
        curl_setopt($ch, CURLOPT_IPRESOLVE, CURL_IPRESOLVE_V4);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, false);
        if (!empty($headers)) {
            curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        }
        $res = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($res !== false && $code >= 200 && $code < 300) {
            return json_decode($res, true);
        }
        if (($code === 429 || $code >= 500) && $attempt < $retries) {
            usleep(450000 * $attempt);
            continue;
        }
        return null;
    }
    return null;
}

$apiToken = getenv('ADSTERRA_API_TOKEN') ?: '';
if (empty($apiToken) && !empty($supabaseUrl) && !empty($supabaseAnonKey)) {
    $secretRes = httpGetJson(
        rtrim($supabaseUrl, '/') . '/rest/v1/settings?id=eq.adsterra_secrets&select=*',
        [
            'apikey: ' . $supabaseAnonKey,
            'Authorization: Bearer ' . $supabaseAnonKey,
            'Content-Type: application/json'
        ]
    );
    if (is_array($secretRes) && isset($secretRes[0]['data'])) {
        $sd = $secretRes[0]['data'];
        if (is_string($sd)) $sd = json_decode($sd, true) ?: [];
        if (is_array($sd) && !empty($sd['apiToken'])) {
            $apiToken = trim($sd['apiToken']);
        }
    }
}

if (empty($apiToken)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Adsterra API token not configured']);
    exit;
}

$range = $_GET['range'] ?? '7d';
$todayUtc = gmdate('Y-m-d');
$yesterdayUtc = gmdate('Y-m-d', time() - 86400);

if ($range === 'today') {
    $startDate = $todayUtc;
    $finishDate = $todayUtc;
} elseif ($range === 'yesterday') {
    $startDate = $yesterdayUtc;
    $finishDate = $yesterdayUtc;
} elseif ($range === '30d') {
    $startDate = gmdate('Y-m-d', time() - (29 * 86400));
    $finishDate = $todayUtc;
} elseif ($range === 'total') {
    $startDate = gmdate('Y-m-d', time() - (365 * 86400));
    $finishDate = $todayUtc;
} else {
    $range = '7d';
    $startDate = gmdate('Y-m-d', time() - (6 * 86400));
    $finishDate = $todayUtc;
}

$monthStartUtc = substr($todayUtc, 0, 7) . '-01';
$year1Start = gmdate('Y-m-d', time() - (365 * 86400));
$year2End = gmdate('Y-m-d', time() - (366 * 86400));
$year2Start = gmdate('Y-m-d', time() - (730 * 86400));

$adHeaders = [
    'Accept: application/json',
    'X-API-Key: ' . $apiToken
];
$base = 'https://api3.adsterratools.com/publisher';

$domainsRes = httpGetJson("{$base}/domains.json", $adHeaders) ?: ['items' => []];
usleep(120000);
$dailyRes = httpGetJson("{$base}/stats.json?start_date={$startDate}&finish_date={$finishDate}&group_by=date", $adHeaders);
usleep(120000);
$allTimeY1Res = httpGetJson("{$base}/stats.json?start_date={$year1Start}&finish_date={$todayUtc}&group_by=domain", $adHeaders) ?: ['items' => []];
usleep(120000);
$monthDailyRes = httpGetJson("{$base}/stats.json?start_date={$monthStartUtc}&finish_date={$todayUtc}&group_by=date", $adHeaders) ?: ['items' => []];

if ($dailyRes === null) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'Failed to fetch Adsterra statistics']);
    exit;
}

$domainMap = [];
foreach (($domainsRes['items'] ?? []) as $d) {
    if (isset($d['id'])) {
        $domainMap[(string)$d['id']] = $d['title'] ?? (string)$d['id'];
    }
}

$dailyItems = $dailyRes['items'] ?? [];
$totalRevenue = 0.0;
$totalImpressions = 0;
$totalClicks = 0;
foreach ($dailyItems as $row) {
    $totalRevenue += (float)($row['revenue'] ?? 0);
    $totalImpressions += (int)($row['impression'] ?? 0);
    $totalClicks += (int)($row['clicks'] ?? 0);
}

$avgCpm = $totalImpressions > 0 ? round(($totalRevenue / $totalImpressions) * 1000, 4) : 0;
$avgCtr = $totalImpressions > 0 ? round(($totalClicks / $totalImpressions) * 100, 3) : 0;

$allTimeRev = 0.0;
$allTimeImp = 0;
$allTimeClicks = 0;
$domainTotalsMap = [];
foreach (($allTimeY1Res['items'] ?? []) as $row) {
    $rev = (float)($row['revenue'] ?? 0);
    $imp = (int)($row['impression'] ?? 0);
    $clk = (int)($row['clicks'] ?? 0);
    $allTimeRev += $rev;
    $allTimeImp += $imp;
    $allTimeClicks += $clk;

    $domId = (string)($row['domain'] ?? '');
    if (!isset($domainTotalsMap[$domId])) {
        $domainTotalsMap[$domId] = [
            'domainId' => $domId,
            'title' => $domainMap[$domId] ?? ('Domain #' . $domId),
            'revenue' => 0.0,
            'impression' => 0,
            'clicks' => 0
        ];
    }
    $domainTotalsMap[$domId]['revenue'] += $rev;
    $domainTotalsMap[$domId]['impression'] += $imp;
    $domainTotalsMap[$domId]['clicks'] += $clk;
}

$domainTotals = [];
foreach ($domainTotalsMap as $d) {
    $imp = $d['impression'];
    $rev = $d['revenue'];
    $clk = $d['clicks'];
    $domainTotals[] = [
        'domainId' => $d['domainId'],
        'title' => $d['title'],
        'revenue' => round($rev, 4),
        'impression' => $imp,
        'clicks' => $clk,
        'cpm' => $imp > 0 ? round(($rev / $imp) * 1000, 4) : 0,
        'ctr' => $imp > 0 ? round(($clk / $imp) * 100, 3) : 0
    ];
}
usort($domainTotals, function ($a, $b) {
    return $b['revenue'] <=> $a['revenue'];
});

$totalIncome = [
    'revenue' => round($allTimeRev, 4),
    'impression' => $allTimeImp,
    'clicks' => $allTimeClicks,
    'cpm' => $allTimeImp > 0 ? round(($allTimeRev / $allTimeImp) * 1000, 4) : 0,
    'ctr' => $allTimeImp > 0 ? round(($allTimeClicks / $allTimeImp) * 100, 3) : 0,
    'domains' => $domainTotals
];

$monthRev = 0.0;
$monthImp = 0;
$monthClicks = 0;
$todayRev = 0.0;
$todayImp = 0;
$todayClicks = 0;
$todayCpm = 0.0;

foreach (($monthDailyRes['items'] ?? []) as $row) {
    $rev = (float)($row['revenue'] ?? 0);
    $imp = (int)($row['impression'] ?? 0);
    $clk = (int)($row['clicks'] ?? 0);
    $monthRev += $rev;
    $monthImp += $imp;
    $monthClicks += $clk;
    if (($row['date'] ?? '') === $todayUtc) {
        $todayRev = $rev;
        $todayImp = $imp;
        $todayClicks = $clk;
        $todayCpm = (float)($row['cpm'] ?? 0);
    }
}

if ($todayImp === 0) {
    foreach ($dailyItems as $row) {
        if (($row['date'] ?? '') === $todayUtc) {
            $todayRev = (float)($row['revenue'] ?? 0);
            $todayImp = (int)($row['impression'] ?? 0);
            $todayClicks = (int)($row['clicks'] ?? 0);
            $todayCpm = (float)($row['cpm'] ?? 0);
            break;
        }
    }
}

$todayIncome = [
    'date' => $todayUtc,
    'revenue' => round($todayRev, 4),
    'impression' => $todayImp,
    'clicks' => $todayClicks,
    'cpm' => $todayCpm > 0 ? $todayCpm : ($todayImp > 0 ? round(($todayRev / $todayImp) * 1000, 4) : 0)
];

$monthIncome = [
    'startDate' => $monthStartUtc,
    'finishDate' => $todayUtc,
    'revenue' => round($monthRev, 4),
    'impression' => $monthImp,
    'clicks' => $monthClicks,
    'cpm' => $monthImp > 0 ? round(($monthRev / $monthImp) * 1000, 4) : 0
];

echo json_encode([
    'ok' => true,
    'range' => $range,
    'startDate' => $startDate,
    'finishDate' => $finishDate,
    'dbLastUpdateTime' => $dailyRes['dbLastUpdateTime'] ?? null,
    'summary' => [
        'revenue' => round($totalRevenue, 4),
        'impression' => $totalImpressions,
        'clicks' => $totalClicks,
        'cpm' => $avgCpm,
        'ctr' => $avgCtr
    ],
    'todayIncome' => $todayIncome,
    'monthIncome' => $monthIncome,
    'totalIncome' => $totalIncome,
    'domains' => $domainsRes['items'] ?? [],
    'daily' => $dailyItems,
    'placements' => [],
    'countries' => []
]);
