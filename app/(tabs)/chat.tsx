import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useChat } from "@/src/presentation/hooks/useChat";
import { useAuth } from "@/src/presentation/hooks/useAuth";
import { Mensaje } from "@/src/domain/models/Mensaje";

export default function ChatScreen() {
  const { mensajes, cargando, enviando, usuariosEscribiendo, enviarMensaje, notificarEscritura } = useChat();
  const { usuario } = useAuth();
  const [textoMensaje, setTextoMensaje] = useState("");
  const flatListRef = useRef<FlatList>(null);

  // Auto-scroll al final cuando llegan nuevos mensajes
  useEffect(() => {
    if (mensajes.length > 0) {
      flatListRef.current?.scrollToEnd({ animated: true });
    }
  }, [mensajes]);

  const handleEnviar = async () => {
    if (!textoMensaje.trim() || enviando) return;

    const mensaje = textoMensaje;
    setTextoMensaje(""); // Limpiar input inmediatamente

    const resultado = await enviarMensaje(mensaje);

    if (!resultado.success) {
      alert("Error: " + resultado.error);
      setTextoMensaje(mensaje); // Restaurar mensaje si falló
    }
  };

  const handleTextoChange = (texto: string) => {
    setTextoMensaje(texto);
    // Notificar que el usuario está escribiendo
    if (texto.trim()) {
      notificarEscritura();
    }
  };

  const renderMensaje = ({ item }: { item: Mensaje }) => {
    const esMio = item.usuario_id === usuario?.id;
    // 🆕 Mostrar el correo completo del usuario
    const emailUsuario = item.usuario?.email || "desconocido@usuario.com";
    const rolUsuario = item.usuario?.rol || "usuario";
    const esChef = rolUsuario === "chef";

    return (
      <View
        style={[
          styles.mensajeContainer,
          esMio ? styles.mensajeMio : styles.mensajeOtro,
        ]}
      >
        {/* 🆕 ETIQUETA DE USUARIO MEJORADA */}
        <View style={styles.headerMensaje}>
          <View style={styles.usuarioInfo}>
            <Text style={[
              styles.nombreUsuario,
              esMio && styles.nombreUsuarioMio
            ]}>
              {esMio ? "Tú" : emailUsuario}
            </Text>
            
            {/* Badge del rol */}
            {esChef && (
              <View style={[
                styles.badge,
                esMio ? styles.badgeMio : styles.badgeOtro
              ]}>
                <Text style={[
                  styles.badgeText,
                  esMio && styles.badgeTextMio
                ]}>
                  👨‍🍳 Chef
                </Text>
              </View>
            )}
          </View>
        </View>

        <Text style={[
          styles.contenidoMensaje,
          esMio && styles.contenidoMensajeMio
        ]}>
          {item.contenido}
        </Text>

        <Text style={[
          styles.horaMensaje,
          esMio && styles.horaMensajeMio
        ]}>
          {new Date(item.created_at).toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>
    );
  };

  if (cargando) {
    return (
      <View style={styles.centrado}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.textoCargando}>Cargando mensajes...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={100}
    >
      <FlatList
        ref={flatListRef}
        data={mensajes}
        renderItem={renderMensaje}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd()}
      />

      {/* 🆕 INDICADOR DE ESCRITURA MEJORADO */}
      {usuariosEscribiendo.length > 0 && (
        <TypingIndicator usuarios={usuariosEscribiendo} />
      )}

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          value={textoMensaje}
          onChangeText={handleTextoChange}
          placeholder="Escribe un mensaje..."
          multiline
          maxLength={500}
        />
        <TouchableOpacity
          style={[
            styles.botonEnviar,
            (!textoMensaje.trim() || enviando) && styles.botonDeshabilitado,
          ]}
          onPress={handleEnviar}
          disabled={!textoMensaje.trim() || enviando}
        >
          <Text style={styles.textoBotonEnviar}>
            {enviando ? "..." : "Enviar"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

// 🆕 COMPONENTE SEPARADO PARA EL TYPING INDICATOR CON ANIMACIÓN
function TypingIndicator({ usuarios }: { usuarios: string[] }) {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createAnimation = (dot: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(dot, {
            toValue: 1,
            duration: 400,
            delay,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 400,
            useNativeDriver: true,
          }),
        ])
      );
    };

    const anim1 = createAnimation(dot1, 0);
    const anim2 = createAnimation(dot2, 150);
    const anim3 = createAnimation(dot3, 300);

    anim1.start();
    anim2.start();
    anim3.start();

    return () => {
      anim1.stop();
      anim2.stop();
      anim3.stop();
    };
  }, []);

  const nombreCorto = usuarios.slice(0, 2).map(email => email.split('@')[0]);
  const textoUsuarios = nombreCorto.join(", ");
  const masUsuarios = usuarios.length > 2 ? ` y ${usuarios.length - 2} más` : "";

  return (
    <View style={styles.typingIndicatorContainer}>
      <Text style={styles.typingIndicatorText}>
        {textoUsuarios}{masUsuarios} está{usuarios.length > 1 ? "n" : ""} escribiendo
      </Text>
      <View style={styles.typingDots}>
        <Animated.View
          style={[
            styles.dot,
            {
              opacity: dot1,
              transform: [
                {
                  translateY: dot1.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -5],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            {
              opacity: dot2,
              transform: [
                {
                  translateY: dot2.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -5],
                  }),
                },
              ],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.dot,
            {
              opacity: dot3,
              transform: [
                {
                  translateY: dot3.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -5],
                  }),
                },
              ],
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  centrado: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  textoCargando: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  listContainer: {
    padding: 16,
  },
  mensajeContainer: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  mensajeMio: {
    alignSelf: "flex-end",
    backgroundColor: "#007AFF",
  },
  mensajeOtro: {
    alignSelf: "flex-start",
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "#E0E0E0",
  },
  headerMensaje: {
    marginBottom: 4,
  },
  // 🆕 ESTILOS PARA LA ETIQUETA DE USUARIO
  usuarioInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  nombreUsuario: {
    fontSize: 13,
    fontWeight: "700",
    color: "#666",
  },
  nombreUsuarioMio: {
    color: "rgba(255, 255, 255, 0.95)",
    fontWeight: "700",
  },
  badge: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  badgeMio: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
  },
  badgeOtro: {
    backgroundColor: "#4CAF50",
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FFF",
  },
  badgeTextMio: {
    color: "#FFF",
  },
  contenidoMensaje: {
    fontSize: 16,
    color: "#000",
    lineHeight: 22,
  },
  contenidoMensajeMio: {
    color: "#FFF",
  },
  horaMensaje: {
    fontSize: 10,
    color: "#999",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  horaMensajeMio: {
    color: "rgba(255, 255, 255, 0.7)",
  },
  inputContainer: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#F5F5F5",
    borderRadius: 20,
    fontSize: 16,
  },
  botonEnviar: {
    marginLeft: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#007AFF",
    borderRadius: 20,
    justifyContent: "center",
  },
  botonDeshabilitado: {
    backgroundColor: "#CCC",
  },
  textoBotonEnviar: {
    color: "#FFF",
    fontWeight: "600",
    fontSize: 16,
  },
  // 🆕 ESTILOS MEJORADOS PARA EL TYPING INDICATOR
  typingIndicatorContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#FFF",
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
  },
  typingIndicatorText: {
    fontSize: 13,
    color: "#666",
    marginRight: 8,
    fontStyle: "italic",
    fontWeight: "500",
  },
  typingDots: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#007AFF",
  },
});