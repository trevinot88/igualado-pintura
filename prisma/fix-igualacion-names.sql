-- Script para actualizar el campo 'name' de IgualacionLine
-- Este script copia la descripción al campo name (que actualmente está duplicando el código)

UPDATE "IgualacionLine" SET name = description WHERE description IS NOT NULL;
