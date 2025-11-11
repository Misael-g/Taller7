import { supabase } from "@/src/data/services/supabaseClient";
import { Mensaje } from "../../models/Mensaje";
import { RealtimeChannel } from "@supabase/supabase-js";

export class ChatUseCase {
  private channel: RealtimeChannel | null = null;
  private typingChannel: RealtimeChannel | null = null;

  // Obtener mensajes históricos
  async obtenerMensajes(limite: number = 50): Promise<Mensaje[]> {
    try {
      // 🔧 CORREGIDO: Usar la sintaxis correcta para el JOIN
      const { data, error } = await supabase
        .from("mensajes")
        .select(`
          *,
          usuario:usuarios(email, rol)
        `)
        .order("created_at", { ascending: false })
        .limit(limite);

      if (error) {
        console.error("❌ Error al obtener mensajes:", error);
        throw error;
      }

      console.log("📥 Mensajes obtenidos:", data);

      // Mapear la respuesta para que tenga la estructura correcta
      const mensajesFormateados = (data || []).map((msg: any) => {
        console.log("📝 Mensaje individual:", msg);
        return {
          id: msg.id,
          contenido: msg.contenido,
          usuario_id: msg.usuario_id,
          created_at: msg.created_at,
          usuario: msg.usuario // Ahora es 'usuario' singular
        };
      });

      // Invertir el orden para mostrar del más antiguo al más reciente
      return mensajesFormateados.reverse() as Mensaje[];
    } catch (error) {
      console.error("❌ Error al obtener mensajes:", error);
      return [];
    }
  }

  // Enviar un nuevo mensaje
  async enviarMensaje(contenido: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        return { success: false, error: "Usuario no autenticado" };
      }

      const { error } = await supabase
        .from("mensajes")
        .insert({
          contenido,
          usuario_id: user.id,
        });

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error("❌ Error al enviar mensaje:", error);
      return { success: false, error: error.message };
    }
  }

  // Suscribirse a nuevos mensajes en tiempo real
  suscribirseAMensajes(callback: (mensaje: Mensaje) => void) {
    // Crear canal único para esta suscripción
    this.channel = supabase.channel('mensajes-channel');

    this.channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'mensajes'
        },
        async (payload) => {
          console.log('📨 Nuevo mensaje recibido!', payload.new);

          try {
            // 🔧 CORREGIDO: Usar la sintaxis correcta para el JOIN
            const { data, error } = await supabase
              .from("mensajes")
              .select(`
                *,
                usuario:usuarios(email, rol)
              `)
              .eq('id', payload.new.id)
              .single();

            if (error) {
              console.error('⚠️ Error al obtener mensaje completo:', error);

              // Fallback: usar los datos del payload si falla el JOIN
              const mensajeFallback: Mensaje = {
                id: payload.new.id,
                contenido: payload.new.contenido,
                usuario_id: payload.new.usuario_id,
                created_at: payload.new.created_at,
                usuario: {
                  email: 'desconocido@usuario.com',
                  rol: 'usuario'
                }
              };

              console.log('🔄 Usando mensaje fallback');
              callback(mensajeFallback);
              return;
            }

            if (data) {
              console.log('✅ Mensaje completo obtenido:', data);
              
              // Formatear el mensaje
              const mensajeFormateado: Mensaje = {
                id: data.id,
                contenido: data.contenido,
                usuario_id: data.usuario_id,
                created_at: data.created_at,
                usuario: data.usuario || { email: 'desconocido@usuario.com', rol: 'usuario' }
              };

              callback(mensajeFormateado);
            }
          } catch (err) {
            console.error('❌ Error inesperado:', err);

            // Fallback final
            const mensajeFallback: Mensaje = {
              id: payload.new.id,
              contenido: payload.new.contenido,
              usuario_id: payload.new.usuario_id,
              created_at: payload.new.created_at,
              usuario: {
                email: 'desconocido@usuario.com',
                rol: 'usuario'
              }
            };

            callback(mensajeFallback);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Estado de suscripción:', status);
      });

    // Retornar función para desuscribirse
    return () => {
      if (this.channel) {
        supabase.removeChannel(this.channel);
        this.channel = null;
      }
    };
  }

  // Eliminar un mensaje (opcional)
  async eliminarMensaje(mensajeId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from("mensajes")
        .delete()
        .eq('id', mensajeId);

      if (error) throw error;

      return { success: true };
    } catch (error: any) {
      console.error("❌ Error al eliminar mensaje:", error);
      return { success: false, error: error.message };
    }
  }

  // Notificar que el usuario está escribiendo
  async notificarEscritura(): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("typing_indicators")
        .upsert({
          usuario_id: user.id,
          updated_at: new Date().toISOString()
        }, { onConflict: "usuario_id" });
    } catch (error) {
      console.error("❌ Error al notificar escritura:", error);
    }
  }

  // Suscribirse a indicadores de escritura
  suscribirseAEscritura(callback: (usuariosEscribiendo: string[]) => void) {
    this.typingChannel = supabase.channel('typing-channel');

    // Función para obtener usuarios escribiendo
    const obtenerUsuariosEscribiendo = async () => {
      try {
        // 🔧 Obtener usuarios que escribieron en los últimos 3 segundos
        const { data, error } = await supabase
          .from("typing_indicators")
          .select("usuario_id, usuario:usuarios(email)")
          .gt("updated_at", new Date(Date.now() - 3000).toISOString());

        if (!error && data) {
          console.log("👀 Usuarios escribiendo:", data);
          // Obtener TODOS los emails (incluyendo el propio)
          const emails = data
            .map((item: any) => item.usuario?.email)
            .filter(Boolean);
          callback(emails);
        } else {
          callback([]);
        }
      } catch (err) {
        console.error('❌ Error al obtener usuarios escribiendo:', err);
        callback([]);
      }
    };

    // Suscribirse a cambios en la tabla
    this.typingChannel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'typing_indicators'
        },
        async () => {
          await obtenerUsuariosEscribiendo();
        }
      )
      .subscribe(async (status) => {
        console.log('📡 Estado de suscripción typing:', status);
        if (status === 'SUBSCRIBED') {
          // Cargar usuarios escribiendo inicialmente
          await obtenerUsuariosEscribiendo();
        }
      });

    // Actualizar cada segundo para limpiar usuarios inactivos
    const intervalo = setInterval(async () => {
      await obtenerUsuariosEscribiendo();
    }, 1000);

    // Retornar función para desuscribirse
    return () => {
      if (this.typingChannel) {
        supabase.removeChannel(this.typingChannel);
        this.typingChannel = null;
      }
      clearInterval(intervalo);
    };
  }
}