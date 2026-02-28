-- ============================================
-- SCRIPT PARA LIMPIAR USUARIOS DE PRUEBA Y ARREGLAR EL TRIGGER
-- Ejecuta este SQL en: Supabase Dashboard → SQL Editor
-- ============================================

-- PASO 1: Limpiar usuarios de prueba existentes
-- ============================================

-- Eliminar predicciones de usuarios de prueba
DELETE FROM predictions 
WHERE user_id IN (
  SELECT id FROM profiles WHERE is_test = true
);

-- Eliminar perfiles de prueba
DELETE FROM profiles WHERE is_test = true;

-- PASO 2: Eliminar el trigger antiguo
-- ============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- PASO 3: Crear nuevo trigger mejorado
-- ============================================

-- Esta función solo crea perfiles para usuarios NUEVOS que no tienen perfil
-- y que realmente existen en auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Solo crear perfil si no existe uno ya
  INSERT INTO public.profiles (id, full_name, username, role)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    new.raw_user_meta_data->>'username', 
    'user'
  )
  ON CONFLICT (id) DO NOTHING; -- No hacer nada si ya existe
  
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear el trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW 
  EXECUTE PROCEDURE public.handle_new_user();

-- PASO 4: Crear trigger para limpiar perfiles huérfanos
-- ============================================

-- Esta función elimina el perfil cuando se elimina el usuario de auth
CREATE OR REPLACE FUNCTION public.handle_user_delete()
RETURNS TRIGGER AS $$
BEGIN
  -- Eliminar predicciones primero
  DELETE FROM public.predictions WHERE user_id = old.id;
  
  -- Eliminar perfil
  DELETE FROM public.profiles WHERE id = old.id;
  
  RETURN old;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crear trigger para eliminación
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
  AFTER DELETE ON auth.users
  FOR EACH ROW 
  EXECUTE PROCEDURE public.handle_user_delete();

-- ============================================
-- VERIFICACIÓN
-- ============================================

-- Verificar que no hay usuarios de prueba
SELECT COUNT(*) as test_users_remaining 
FROM profiles 
WHERE is_test = true;

-- Debería retornar 0

-- ============================================
-- NOTAS IMPORTANTES
-- ============================================

-- 1. El nuevo trigger usa ON CONFLICT DO NOTHING para evitar recrear perfiles
-- 2. Se agregó un trigger de eliminación que limpia automáticamente los perfiles
--    cuando se elimina un usuario de auth.users
-- 3. Ahora cuando elimines usuarios desde el admin panel, se eliminarán completamente
--    y no se recrearán automáticamente
