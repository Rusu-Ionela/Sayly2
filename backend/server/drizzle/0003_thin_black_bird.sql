-- The durable 0000_baseline migration already creates the complete original
-- schema (including every type, table, constraint, and index that this
-- auto-generated snapshot duplicated). Keeping that SQL here caused a clean
-- database to fail at the first duplicate enum. Existing databases have this
-- timestamp recorded already; new databases record this no-op and continue to
-- the incremental migrations below.
SELECT 1;
