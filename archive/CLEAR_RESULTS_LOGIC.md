# Implementación de "Borrar Resultados"

Se ha implementado una función segura en la base de datos para manejar el borrado de resultados de partidos.

## Problema Original
Cuando se borraban los resultados desde el admin panel, los puntos de los usuarios no se recalculaban correctamente porque:
1. El trigger de actualización solo se dispara cuando el estado cambia a FINALIZADO ('f'), no cuando regresa a ACTIVO ('a').
2. La actualización manual desde el cliente (navegador) podía fallar por permisos (RLS) o inconsistencias de red.
3. Los puntos en el perfil (`profiles.points`) no se actualizaban automáticamente al poner en 0 los puntos de la predicción.

## Solución Implementada
Se creó una función RPC (Remote Procedure Call) en PostgreSQL llamada `clear_match_stats`.

### Función SQL (`clear_match_stats`)
Esta función realiza 3 acciones atómicas en el servidor:
1. **Reinicia el Partido**: Pone el marcador a `NULL` y el estado a `Activo` ('a').
2. **Reinicia Puntos de Predicciones**: Establece `points_earned = 0` para todas las predicciones de ese partido.
3. **Recalcula Puntos de Usuario**: Itera sobre los usuarios afectados y recalcula su puntaje total sumando todas sus predicciones restantes.

```sql
CREATE OR REPLACE FUNCTION clear_match_stats(target_match_id int)
RETURNS void AS $$
DECLARE
    p record;
BEGIN
    -- 1. Reset Match
    UPDATE matches 
    SET home_score = NULL, away_score = NULL, status = 'a'
    WHERE id = target_match_id;

    -- 2. Reset Points in Predictions
    UPDATE predictions
    SET points_earned = 0
    WHERE match_id = target_match_id;

    -- 3. Update Profiles for affected users
    FOR p IN SELECT user_id FROM predictions WHERE match_id = target_match_id LOOP
        UPDATE profiles
        SET points = (SELECT coalesce(sum(points_earned), 0) FROM predictions WHERE user_id = p.user_id)
        WHERE id = p.user_id;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Cambio en `admin.js`
Se actualizó la función `clearResults()` para invocar esta función RPC en lugar de hacer múltiples llamadas desde el cliente.

```javascript
// Use RPC to reset match and recalculate points for all affected users
const { error } = await supabase.rpc('clear_match_stats', {
    target_match_id: match.id
});
```

Ahora el borrado es seguro, rápido y garantiza la integridad de los datos en la tabla de posiciones.
