import * as ImagePicker from "expo-image-picker";
import { supabase } from "../../../data/services/supabaseClient";
import { Receta } from "../../models/Receta";
import { decode } from "base64-arraybuffer";

export class RecipesUseCase {
  // Obtener todas las recetas
  async obtenerRecetas(): Promise<Receta[]> {
    try {
      const { data, error } = await supabase
        .from("recetas")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      console.log("📥 Recetas obtenidas:", data?.length || 0);
      if (data && data.length > 0) {
        console.log("🖼️ Primera receta imagen_url:", data[0].imagen_url);
      }
      
      return data || [];
    } catch (error) {
      console.log("❌ Error al obtener recetas:", error);
      return [];
    }
  }

  // Buscar recetas por ingrediente
  async buscarPorIngrediente(ingrediente: string): Promise<Receta[]> {
    try {
      const { data, error } = await supabase
        .from("recetas")
        .select("*")
        .contains("ingredientes", [ingrediente])
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.log("❌ Error en búsqueda:", error);
      return [];
    }
  }

  // Crear nueva receta
  async crearReceta(
    titulo: string,
    descripcion: string,
    ingredientes: string[],
    chefId: string,
    imagenUri?: string
  ) {
    try {
      console.log("🔵 Iniciando creación de receta...");
      console.log("📝 Título:", titulo);
      console.log("🖼️ Tiene imagen:", !!imagenUri);
      
      let imagenUrl = null;

      if (imagenUri) {
        console.log("📤 Subiendo imagen...");
        imagenUrl = await this.subirImagen(imagenUri);
        console.log("✅ URL de imagen obtenida:", imagenUrl);
      }

      console.log("💾 Insertando en base de datos...");
      const { data, error } = await supabase
        .from("recetas")
        .insert({
          titulo,
          descripcion,
          ingredientes,
          chef_id: chefId,
          imagen_url: imagenUrl,
        })
        .select()
        .single();

      if (error) {
        console.log("❌ Error al insertar:", error);
        throw error;
      }
      
      console.log("✅ Receta creada exitosamente:", data);
      return { success: true, receta: data };
    } catch (error: any) {
      console.log("❌ Error en crearReceta:", error);
      return { success: false, error: error.message };
    }
  }

  // Actualizar receta existente
  async actualizarReceta(
    id: string,
    titulo: string,
    descripcion: string,
    ingredientes: string[],
    imagenUri?: string,
    imagenUrlAnterior?: string
  ) {
    try {
      console.log("🔵 Actualizando receta...");
      let imagenUrl = imagenUrlAnterior;

      if (imagenUri) {
        console.log("📤 Subiendo nueva imagen...");
        
        if (imagenUrlAnterior) {
          console.log("🗑️ Eliminando imagen anterior...");
          await this.eliminarImagen(imagenUrlAnterior);
        }
        
        imagenUrl = await this.subirImagen(imagenUri);
        console.log("✅ Nueva URL de imagen:", imagenUrl);
      }

      const { data, error } = await supabase
        .from("recetas")
        .update({
          titulo,
          descripcion,
          ingredientes,
          imagen_url: imagenUrl,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      
      console.log("✅ Receta actualizada:", data);
      return { success: true, receta: data };
    } catch (error: any) {
      console.log("❌ Error en actualizarReceta:", error);
      return { success: false, error: error.message };
    }
  }

  // Eliminar receta
  async eliminarReceta(id: string) {
    try {
      const { data: receta } = await supabase
        .from("recetas")
        .select("imagen_url")
        .eq("id", id)
        .single();

      if (receta?.imagen_url) {
        await this.eliminarImagen(receta.imagen_url);
      }

      const { error } = await supabase.from("recetas").delete().eq("id", id);

      if (error) throw error;
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  // Subir imagen a Supabase Storage (MÉTODO CORREGIDO)
  private async subirImagen(uri: string): Promise<string | null> {
    try {
      console.log("📤 [subirImagen] URI recibida:", uri);
      
      const extension = uri.split(".").pop();
      const nombreArchivo = `${Date.now()}.${extension}`;
      console.log("📝 [subirImagen] Nombre archivo:", nombreArchivo);

      // Método 1: Usando fetch y arrayBuffer (recomendado para React Native)
      console.log("🔄 [subirImagen] Leyendo archivo...");
      const response = await fetch(uri);
      const arrayBuffer = await response.arrayBuffer();
      console.log("✅ [subirImagen] ArrayBuffer creado:", arrayBuffer.byteLength, "bytes");

      // Subir a Supabase Storage usando arrayBuffer
      console.log("☁️ [subirImagen] Subiendo a Supabase Storage...");
      const { data, error } = await supabase.storage
        .from("recetas-fotos")
        .upload(nombreArchivo, arrayBuffer, {
          contentType: `image/${extension}`,
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.log("❌ [subirImagen] Error al subir:", error);
        throw error;
      }

      console.log("✅ [subirImagen] Archivo subido:", data);

      // Obtener la URL pública
      const { data: urlData } = supabase.storage
        .from("recetas-fotos")
        .getPublicUrl(nombreArchivo);

      console.log("🔗 [subirImagen] URL pública generada:", urlData.publicUrl);
      
      return urlData.publicUrl;
    } catch (error) {
      console.log("❌ [subirImagen] Error completo:", error);
      return null;
    }
  }

  // Eliminar imagen de Supabase Storage
  private async eliminarImagen(imagenUrl: string): Promise<void> {
    try {
      console.log("🗑️ [eliminarImagen] Eliminando:", imagenUrl);
      
      const urlParts = imagenUrl.split("/");
      const nombreArchivo = urlParts[urlParts.length - 1];
      
      console.log("📝 [eliminarImagen] Nombre archivo:", nombreArchivo);

      const { error } = await supabase.storage
        .from("recetas-fotos")
        .remove([nombreArchivo]);

      if (error) {
        console.log("❌ [eliminarImagen] Error:", error);
      } else {
        console.log("✅ [eliminarImagen] Imagen eliminada");
      }
    } catch (error) {
      console.log("❌ [eliminarImagen] Error completo:", error);
    }
  }

  // Seleccionar imagen de la galería
  async seleccionarImagen(): Promise<string | null> {
    try {
      console.log("🖼️ Solicitando permisos de galería...");
      
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (status !== "granted") {
        console.log("❌ Permisos denegados");
        alert("Necesitamos permisos para acceder a tus fotos");
        return null;
      }

      console.log("✅ Permisos concedidos, abriendo galería...");

      const resultado = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!resultado.canceled) {
        console.log("✅ Imagen seleccionada:", resultado.assets[0].uri);
        return resultado.assets[0].uri;
      }

      console.log("ℹ️ Usuario canceló la selección");
      return null;
    } catch (error) {
      console.log("❌ Error al seleccionar imagen:", error);
      return null;
    }
  }

  // Tomar foto con la cámara
  async tomarFoto(): Promise<string | null> {
    try {
      console.log("📷 Solicitando permisos de cámara...");
      
      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      if (status !== "granted") {
        console.log("❌ Permisos de cámara denegados");
        alert("Necesitamos permisos para usar la cámara");
        return null;
      }

      console.log("✅ Permisos concedidos, abriendo cámara...");

      const resultado = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!resultado.canceled) {
        console.log("✅ Foto tomada:", resultado.assets[0].uri);
        return resultado.assets[0].uri;
      }

      console.log("ℹ️ Usuario canceló la captura");
      return null;
    } catch (error) {
      console.log("❌ Error al tomar foto:", error);
      return null;
    }
  }
}