# Data Layer API Documentation

This document describes the HTTP API provided by the Database Service.

## Base URL

```
http://localhost:3001
```

## Authentication

Currently, the API does not require authentication. This may change in future versions.

## Endpoints

### Words

#### GET /words
Get all words from the dictionary.

**Response:**
```json
{
  "words": [
    {
      "id": "string",
      "text": "string",
      "level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
      "pronunciations": [
        {
          "text": "string",
          "audio": "string"
        }
      ]
    }
  ]
}
```

#### GET /words/:id
Get a specific word by ID.

**Response:**
```json
{
  "id": "string",
  "text": "string",
  "level": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
  "pronunciations": [
    {
      "text": "string",
      "audio": "string"
    }
  ]
}
```

### User Progress

#### GET /users/:userId/progress
Get user's learning progress.

**Response:**
```json
{
  "userId": "string",
  "words": [
    {
      "wordId": "string",
      "status": "known" | "unknown",
      "lastReviewed": "ISO8601 date string"
    }
  ]
}
```

#### POST /users/:userId/progress
Update user's progress for a word.

**Request:**
```json
{
  "wordId": "string",
  "status": "known" | "unknown"
}
```

**Response:**
```json
{
  "success": true
}
```

### SRS (Spaced Repetition System)

#### GET /users/:userId/srs/due
Get words due for review.

**Response:**
```json
{
  "words": [
    {
      "wordId": "string",
      "dueDate": "ISO8601 date string",
      "interval": "number",
      "easeFactor": "number"
    }
  ]
}
```

#### POST /users/:userId/srs/review
Record a review result.

**Request:**
```json
{
  "wordId": "string",
  "difficulty": "easy" | "medium" | "hard" | "again"
}
```

**Response:**
```json
{
  "nextReview": "ISO8601 date string",
  "interval": "number"
}
```

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "string",
  "message": "string",
  "statusCode": "number"
}
```

Common status codes:
- `400` - Bad Request (invalid input)
- `404` - Not Found (resource doesn't exist)
- `500` - Internal Server Error