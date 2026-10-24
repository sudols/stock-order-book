#!/bin/bash
set -e

# Create glassbox_test database for automated testing alongside main glassbox database
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE DATABASE glassbox_test;
    GRANT ALL PRIVILEGES ON DATABASE glassbox_test TO "$POSTGRES_USER";
EOSQL
