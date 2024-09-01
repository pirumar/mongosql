
const { MongoClient } = require('mongodb');

class MongoSqlConverter {
  constructor(connectionString, databaseName) {
    this.client = new MongoClient(connectionString, { useNewUrlParser: true, useUnifiedTopology: true });
    this.databaseName = databaseName;
  }

  async connect() {
    if (!this.client.isConnected()) {
      await this.client.connect();
    }
    this.db = this.client.db(this.databaseName);
  }

  async executeSqlQuery(sqlQuery) {
    await this.connect();

    if (sqlQuery.trim().toUpperCase().startsWith("SELECT")) {
      return await this.executeSelectQuery(sqlQuery);
    } else if (sqlQuery.trim().toUpperCase().startsWith("INSERT")) {
      await this.executeInsertQuery(sqlQuery);
      return [];
    } else if (sqlQuery.trim().toUpperCase().startsWith("UPDATE")) {
      await this.executeUpdateQuery(sqlQuery);
      return [];
    } else if (sqlQuery.trim().toUpperCase().startsWith("DELETE")) {
      await this.executeDeleteQuery(sqlQuery);
      return [];
    } else {
      throw new Error("Unsupported SQL query type.");
    }
  }

  async executeSelectQuery(sqlQuery) {
    const joinMatches = sqlQuery.match(/SELECT\s+(.*)\s+FROM\s+(\w+)((\s+(LEFT|INNER)\s+JOIN\s+\w+\s+ON\s+.*)+)/i);

    if (joinMatches) {
      return await this.executeJoinQuery(sqlQuery, joinMatches);
    }

    const selectMatch = sqlQuery.match(/SELECT\s+(.*)\s+FROM\s+(\w+)/i);
    const fields = selectMatch[1].split(',').map(f => f.trim());
    const collectionName = selectMatch[2];
    const collection = this.db.collection(collectionName);

    const whereClause = this.getWhereClause(sqlQuery);
    const filter = whereClause ? JSON.parse(`{ ${this.convertWhereClauseToMongo(whereClause)} }`) : {};

    const orderClause = this.getOrderByClause(sqlQuery);
    const sort = orderClause ? JSON.parse(`{ ${orderClause} }`) : null;

    const projection = fields.reduce((acc, field) => { acc[field] = 1; return acc; }, {});
    const options = { projection };

    if (sort) {
      options.sort = sort;
    }

    return await collection.find(filter, options).toArray();
  }

  async executeJoinQuery(sqlQuery, joinMatches) {
    const fields = joinMatches[1].split(',').map(f => f.trim());
    const mainCollectionName = joinMatches[2];
    const joinStatements = joinMatches[3].trim().match(/(LEFT|INNER)\s+JOIN\s+\w+\s+ON\s+[^(\s+LEFT|\s+INNER)]*/gi);

    const pipeline = [];
    const mainCollection = this.db.collection(mainCollectionName);

    for (let joinStatement of joinStatements) {
      const joinMatch = joinStatement.match(/(LEFT|INNER)\s+JOIN\s+(\w+)\s+ON\s+(.*)/i);
      const joinType = joinMatch[1].toUpperCase();
      const joinCollectionName = joinMatch[2];
      const joinCondition = joinMatch[3];

      const lookupStage = this.convertJoinToLookup(mainCollectionName, joinCollectionName, joinCondition, joinType);
      pipeline.push(lookupStage);

      if (joinType === 'LEFT') {
        pipeline.push({
          $unwind: {
            path: `$${joinCollectionName}`,
            preserveNullAndEmptyArrays: true
          }
        });
      } else {
        pipeline.push({ $unwind: `$${joinCollectionName}` });
      }
    }

    const projectStage = this.buildProjectionStage(fields);
    pipeline.push(projectStage);

    const whereClause = this.getWhereClause(sqlQuery);
    if (whereClause) {
      const matchStage = { $match: JSON.parse(`{ ${this.convertWhereClauseToMongo(whereClause)} }`) };
      pipeline.push(matchStage);
    }

    const orderClause = this.getOrderByClause(sqlQuery);
    if (orderClause) {
      const sortStage = { $sort: JSON.parse(`{ ${orderClause} }`) };
      pipeline.push(sortStage);
    }

    return await mainCollection.aggregate(pipeline).toArray();
  }

  convertJoinToLookup(mainCollectionName, joinCollectionName, joinCondition, joinType) {
    const [mainField, joinField] = joinCondition.split('=').map(cond => cond.trim());
    const mainFieldName = mainField.split('.').pop();
    const joinFieldName = joinField.split('.').pop();

    return {
      $lookup: {
        from: joinCollectionName,
        localField: mainFieldName,
        foreignField: joinFieldName,
        as: joinCollectionName
      }
    };
  }

  buildProjectionStage(fields) {
    const projection = fields.reduce((acc, field) => {
      const parts = field.split('.');
      if (parts.length === 2) {
        acc[`${parts[1]}`] = `$${field}`;
      } else {
        acc[`${field}`] = 1;
      }
      return acc;
    }, {});

    return { $project: projection };
  }

  async executeInsertQuery(sqlQuery) {
    const insertMatch = sqlQuery.match(/INSERT INTO\s+(\w+)\s+\((.*)\)\s+VALUES\s+\((.*)\)/i);
    const collectionName = insertMatch[1];
    const collection = this.db.collection(collectionName);

    const columns = insertMatch[2].split(',').map(c => c.trim());
    const values = insertMatch[3].split(',').map(v => v.trim());

    const document = columns.reduce((doc, col, i) => {
      doc[col] = values[i];
      return doc;
    }, {});

    await collection.insertOne(document);
  }

  async executeUpdateQuery(sqlQuery) {
    const updateMatch = sqlQuery.match(/UPDATE\s+(\w+)\s+SET\s+(.*)\s+WHERE\s+(.*)/i);
    const collectionName = updateMatch[1];
    const collection = this.db.collection(collectionName);

    const setClause = updateMatch[2];
    const whereClause = updateMatch[3];

    const setDocument = JSON.parse(`{ ${setClause.split(',').map(s => s.trim()).join(', ')} }`);
    const filter = JSON.parse(`{ ${this.convertWhereClauseToMongo(whereClause)} }`);

    await collection.updateOne(filter, { $set: setDocument });
  }

  async executeDeleteQuery(sqlQuery) {
    const deleteMatch = sqlQuery.match(/DELETE FROM\s+(\w+)\s+WHERE\s+(.*)/i);
    const collectionName = deleteMatch[1];
    const collection = this.db.collection(collectionName);

    const whereClause = deleteMatch[2];
    const filter = JSON.parse(`{ ${this.convertWhereClauseToMongo(whereClause)} }`);

    await collection.deleteOne(filter);
  }

  getWhereClause(sqlQuery) {
    const whereMatch = sqlQuery.match(/WHERE\s+(.*?)(ORDER BY|$)/i);
    return whereMatch ? whereMatch[1].trim() : null;
  }

  getOrderByClause(sqlQuery) {
    const orderMatch = sqlQuery.match(/ORDER BY\s+(.*)\s+(ASC|DESC)/i);
    if (orderMatch) {
      const orderField = orderMatch[1].trim();
      const orderDirection = orderMatch[2].toUpperCase() === 'ASC' ? 1 : -1;
      return `"${orderField}": ${orderDirection}`;
    }
    return null;
  }

  convertWhereClauseToMongo(whereClause) {
    if (!whereClause) return '';

    const conditions = whereClause.split(/ AND | OR /).map(cond => this.convertConditionToMongo(cond.trim()));

    return conditions.join(', ');
  }

  convertConditionToMongo(condition) {
    if (condition.includes('>')) {
      const [field, value] = condition.split('>').map(part => part.trim());
      return `"${field}": { "$gt": ${value} }`;
    } else if (condition.includes('<')) {
      const [field, value] = condition.split('<').map(part => part.trim());
      return `"${field}": { "$lt": ${value} }`;
    } else if (condition.includes('=')) {
      const [field, value] = condition.split('=').map(part => part.trim());
      return `"${field}": ${value}`;
    }

    throw new Error("Unsupported condition type.");
  }
}

module.exports = MongoSqlConverter;
