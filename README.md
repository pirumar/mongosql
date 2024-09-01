# MongoSQL

MongoSQL is a Node.js library that converts SQL queries into MongoDB queries. It supports basic SQL operations such as SELECT, INSERT, UPDATE, DELETE, and JOIN operations, making it easier to transition SQL-based queries to MongoDB.

## Installation

```bash
npm install @cabesoft/mongosql
```

## Usage

### 1. Initializing the MongoSqlConverter

Before you can execute any queries, you'll need to initialize the `MongoSqlConverter` by providing the MongoDB connection string and the database name.

```javascript
const MongoSqlConverter = require("mongosql");

const converter = new MongoSqlConverter(
  "mongodb://localhost:27017",
  "testDatabase"
);
```

### 2. SELECT Queries

#### Basic SELECT Query

Convert a basic SQL SELECT query to a MongoDB find query.

```javascript
const sqlQuery = "SELECT name, age FROM Users WHERE age > 30 ORDER BY name ASC";
const results = await converter.executeSqlQuery(sqlQuery);
console.log(results);
```

#### SELECT with INNER JOIN

Convert a SELECT query with an INNER JOIN.

```javascript
const sqlQuery = `
  SELECT Users.name, Orders.total 
  FROM Users 
  INNER JOIN Orders ON Users.userId = Orders.userId 
  WHERE Orders.total > 100 
  ORDER BY Users.name ASC
`;
const results = await converter.executeSqlQuery(sqlQuery);
console.log(results);
```

#### SELECT with LEFT JOIN

Convert a SELECT query with a LEFT JOIN.

```javascript
const sqlQuery = `
  SELECT Users.name, Orders.total 
  FROM Users 
  LEFT JOIN Orders ON Users.userId = Orders.userId 
  WHERE Orders.total > 100 
  ORDER BY Users.name ASC
`;
const results = await converter.executeSqlQuery(sqlQuery);
console.log(results);
```

### 3. INSERT Queries

Convert an SQL INSERT query to a MongoDB insertOne operation.

```javascript
const sqlQuery = "INSERT INTO Users (name, age) VALUES ('John Doe', 29)";
await converter.executeSqlQuery(sqlQuery);
```

### 4. UPDATE Queries

Convert an SQL UPDATE query to a MongoDB updateOne operation.

```javascript
const sqlQuery = "UPDATE Users SET age = 30 WHERE name = 'John Doe'";
await converter.executeSqlQuery(sqlQuery);
```

### 5. DELETE Queries

Convert an SQL DELETE query to a MongoDB deleteOne operation.

```javascript
const sqlQuery = "DELETE FROM Users WHERE name = 'John Doe'";
await converter.executeSqlQuery(sqlQuery);
```

### 6. Complex Queries with Multiple Conditions

MongoSQL also supports complex WHERE clauses with multiple conditions.

#### AND Condition

```javascript
const sqlQuery =
  "SELECT name, age FROM Users WHERE age > 30 AND name = 'John Doe'";
const results = await converter.executeSqlQuery(sqlQuery);
console.log(results);
```

#### OR Condition

```javascript
const sqlQuery =
  "SELECT name, age FROM Users WHERE age > 30 OR name = 'Jane Doe'";
const results = await converter.executeSqlQuery(sqlQuery);
console.log(results);
```

## License

ISC
