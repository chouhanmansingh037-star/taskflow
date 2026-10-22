import pg from "pg";
import { config } from "./config.js";

// A date column should stay a plain "YYYY-MM-DD" string instead of being
// shifted through the server's timezone by the driver.
pg.types.setTypeParser(pg.types.builtins.DATE, (value) => value);
// COUNT() returns bigint; counts here are always small enough for a number.
pg.types.setTypeParser(pg.types.builtins.INT8, (value) => Number(value));

export const pool = new pg.Pool({ connectionString: config.databaseUrl, max: 10 });
