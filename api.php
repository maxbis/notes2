<?php
require_once 'config.php';

header('Content-Type: application/json');

$method = $_SERVER['REQUEST_METHOD'];
try {
    $conn = getDBConnection();
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'error' => 'Database connection failed',
        'details' => $e->getMessage()
    ]);
    exit;
}

switch ($method) {
    case 'GET':
        if (isset($_GET['id'])) {
            // Get single note by hash_id
            $hash_id = $_GET['id'];
            $stmt = $conn->prepare("SELECT * FROM notes WHERE hash_id = ?");
            $stmt->bind_param("s", $hash_id);
            $stmt->execute();
            $result = $stmt->get_result();
            $note = $result->fetch_assoc();
            echo json_encode($note ? $note : ['error' => 'Note not found']);
        } else {
            // Get all notes
            $result = $conn->query("SELECT id, hash_id, title, content, created_at, updated_at FROM notes ORDER BY updated_at DESC");
            $notes = [];
            while ($row = $result->fetch_assoc()) {
                $notes[] = $row;
            }
            echo json_encode($notes);
        }
        break;
        
    case 'POST':
        // Create new note
        $data = json_decode(file_get_contents('php://input'), true);
        $hash_id = generateHashId();
        $title = $data['title'] ?? 'Untitled';
        $content = $data['content'] ?? '';
        
        $stmt = $conn->prepare("INSERT INTO notes (hash_id, title, content) VALUES (?, ?, ?)");
        $stmt->bind_param("sss", $hash_id, $title, $content);
        
        if ($stmt->execute()) {
            $note_id = $conn->insert_id;
            $result = $conn->query("SELECT * FROM notes WHERE id = $note_id");
            echo json_encode($result->fetch_assoc());
        } else {
            echo json_encode(['error' => 'Failed to create note']);
        }
        break;
        
    case 'PUT':
        // Update existing note
        $data = json_decode(file_get_contents('php://input'), true);
        $hash_id = $data['hash_id'];
        $title = $data['title'] ?? '';
        $content = $data['content'] ?? '';
        
        $stmt = $conn->prepare("UPDATE notes SET title = ?, content = ? WHERE hash_id = ?");
        $stmt->bind_param("sss", $title, $content, $hash_id);
        
        if ($stmt->execute()) {
            $result = $conn->query("SELECT * FROM notes WHERE hash_id = '$hash_id'");
            echo json_encode($result->fetch_assoc());
        } else {
            echo json_encode(['error' => 'Failed to update note']);
        }
        break;
        
    case 'DELETE':
        // Delete note
        $data = json_decode(file_get_contents('php://input'), true);
        $hash_id = $data['hash_id'];
        
        $stmt = $conn->prepare("DELETE FROM notes WHERE hash_id = ?");
        $stmt->bind_param("s", $hash_id);
        
        if ($stmt->execute()) {
            echo json_encode(['success' => true]);
        } else {
            echo json_encode(['error' => 'Failed to delete note']);
        }
        break;
        
    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}

$conn->close();
?>
