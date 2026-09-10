"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pool = void 0;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
exports.pool = new pg_1.Pool({
    host: 'dpg-d6675bf5r7bs73cc9eh0-a.singapore-postgres.render.com',
    port: 5432,
    user: 'admin',
    password: 'aTDZtYx7W3dG5vxSvN6xp5HTEpsaNbcN',
    database: 'predicton_db_eyaa',
    ssl: { rejectUnauthorized: false }
});
