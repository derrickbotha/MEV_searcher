-- MEV Dashboard Database Initialization
-- This script runs when PostgreSQL container starts

-- Create the vectors database
CREATE DATABASE IF NOT EXISTS vectors;

-- Connect to mev_dashboard and enable extensions
\c mev_dashboard;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create indexes for better performance
-- These will be created by Django migrations, but we can prepare the database

-- Connect to vectors database
\c vectors;

-- Enable vector extension in vectors database
CREATE EXTENSION IF NOT EXISTS "vector";

-- Create any vector-specific tables if needed
-- (Django migrations will handle the actual table creation)
