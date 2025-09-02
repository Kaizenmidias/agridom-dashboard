<?php
/**
 * Webhook para Deploy Automático
 * WebDesign Dashboard - cPanel
 * 
 * Este arquivo deve ser colocado na raiz do seu domínio
 * URL do webhook: https://seudominio.com/webhook.php
 */

// Configurações
define('WEBHOOK_SECRET', 'seu_webhook_secret_aqui'); // Configure um secret no GitHub
define('PROJECT_PATH', '/home/' . get_current_user() . '/public_html/webdesign');
define('LOG_FILE', 'webhook.log');
define('MAX_LOG_SIZE', 1024 * 1024); // 1MB

// Função para log
function writeLog($message) {
    $timestamp = date('Y-m-d H:i:s');
    $logMessage = "[$timestamp] $message" . PHP_EOL;
    
    // Rotacionar log se muito grande
    if (file_exists(LOG_FILE) && filesize(LOG_FILE) > MAX_LOG_SIZE) {
        rename(LOG_FILE, LOG_FILE . '.old');
    }
    
    file_put_contents(LOG_FILE, $logMessage, FILE_APPEND | LOCK_EX);
}

// Função para resposta JSON
function jsonResponse($success, $message, $data = null) {
    header('Content-Type: application/json');
    echo json_encode([
        'success' => $success,
        'message' => $message,
        'data' => $data,
        'timestamp' => date('c')
    ]);
    exit;
}

// Verificar método HTTP
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    jsonResponse(false, 'Method Not Allowed');
}

writeLog('Webhook recebido de ' . $_SERVER['REMOTE_ADDR']);

// Verificar Content-Type
$contentType = $_SERVER['CONTENT_TYPE'] ?? '';
if (strpos($contentType, 'application/json') === false) {
    writeLog('Content-Type inválido: ' . $contentType);
    jsonResponse(false, 'Content-Type deve ser application/json');
}

// Ler payload
$payload = file_get_contents('php://input');
if (empty($payload)) {
    writeLog('Payload vazio');
    jsonResponse(false, 'Payload vazio');
}

// Verificar assinatura (se configurado)
if (defined('WEBHOOK_SECRET') && WEBHOOK_SECRET !== 'seu_webhook_secret_aqui') {
    $signature = $_SERVER['HTTP_X_HUB_SIGNATURE_256'] ?? '';
    $expectedSignature = 'sha256=' . hash_hmac('sha256', $payload, WEBHOOK_SECRET);
    
    if (!hash_equals($expectedSignature, $signature)) {
        writeLog('Assinatura inválida');
        http_response_code(401);
        jsonResponse(false, 'Assinatura inválida');
    }
}

// Decodificar payload
$data = json_decode($payload, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    writeLog('JSON inválido: ' . json_last_error_msg());
    jsonResponse(false, 'JSON inválido');
}

// Verificar se é um push para a branch main
if (!isset($data['ref']) || $data['ref'] !== 'refs/heads/main') {
    writeLog('Push não é para branch main: ' . ($data['ref'] ?? 'undefined'));
    jsonResponse(true, 'Push ignorado - não é branch main');
}

// Log do evento
$repository = $data['repository']['name'] ?? 'unknown';
$pusher = $data['pusher']['name'] ?? 'unknown';
$commits = count($data['commits'] ?? []);

writeLog("Push recebido - Repo: $repository, Pusher: $pusher, Commits: $commits");

// Verificar se o diretório do projeto existe
if (!is_dir(PROJECT_PATH)) {
    writeLog('Diretório do projeto não encontrado: ' . PROJECT_PATH);
    jsonResponse(false, 'Diretório do projeto não encontrado');
}

// Verificar se o script de deploy existe
$deployScript = PROJECT_PATH . '/deploy.sh';
if (!file_exists($deployScript)) {
    writeLog('Script de deploy não encontrado: ' . $deployScript);
    jsonResponse(false, 'Script de deploy não encontrado');
}

// Executar deploy
writeLog('Iniciando deploy automático...');

// Mudar para o diretório do projeto e executar deploy
$command = "cd " . escapeshellarg(PROJECT_PATH) . " && ./deploy.sh 2>&1";
$output = [];
$returnCode = 0;

exec($command, $output, $returnCode);

$outputString = implode("\n", $output);

if ($returnCode === 0) {
    writeLog('Deploy executado com sucesso');
    writeLog('Output: ' . $outputString);
    jsonResponse(true, 'Deploy executado com sucesso', [
        'output' => $outputString,
        'return_code' => $returnCode
    ]);
} else {
    writeLog('Deploy falhou com código: ' . $returnCode);
    writeLog('Output: ' . $outputString);
    http_response_code(500);
    jsonResponse(false, 'Deploy falhou', [
        'output' => $outputString,
        'return_code' => $returnCode
    ]);
}
?>