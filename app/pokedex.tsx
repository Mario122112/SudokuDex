import React, { useEffect, useState } from 'react';
import {View,Text,TouchableOpacity,Image,ScrollView,StyleSheet, FlatList, Modal,} from 'react-native';
import { Colors } from '@/themes/Colors';
import { getDoc, doc, updateDoc, setDoc, arrayUnion, collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import { getAuth, User } from 'firebase/auth';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { navigate, RootStackParamList } from './navigation'; 
import { router } from 'expo-router';

type Pokemon = {
  id: number;
  name: string;
  sprites: {
    front_default: string;
  };
  types: {
    type: {
      name: string;
    };
  }[];
};


const regiones = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Unova', 'Kalos', 'Alola', 'Galar', 'Paldea'];
const tipos: Tipo[] = ["fire", "water", "grass", "electric", "psychic", "rock", "ground", "fairy", "ghost", "dragon", "normal", "fighting", "bug", "ice", "poison", "steel", "dark", "flying"];
const especiales = ['mega', 'gmax'];

const tiposTraduccion = {
  fire: 'Fuego',
  water: 'Agua',
  grass: 'Planta',
  electric: 'Eléctrico',
  psychic: 'Psíquico',
  rock: 'Roca',
  ground: 'Tierra',
  fairy: 'Hada',
  ghost: 'Fantasma',
  dragon: 'Dragón',
  normal: 'Normal',
  fighting: 'Lucha',
  bug: 'Bicho',
  ice: 'Hielo',
  poison: 'Veneno',
  steel: 'Acero',
  dark: 'Siniestro',
  flying: 'Volador',
};

type Tipo = keyof typeof tiposTraduccion;


const PokedexScreen = () => {
  const [tabActivo, setTabActivo] = useState<'Datos' | 'Pokémons'>('Datos');
  const [pokemons, setPokemons] = useState<Pokemon[]>([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState<string | null>(null);
  const [tipoFiltro, setTipoFiltro] = useState<'region' | 'tipo' | 'especial' | null>(null);
  const [valorFiltro, setValorFiltro] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true); 
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [pokemonsDesbloqueados, setPokemonsDesbloqueados] = useState<number[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [pokemonSeleccionado, setPokemonSeleccionado] = useState<any>(null);
  const [loadingPokemons, setLoadingPokemons] = useState(true);
  const [nombreUsuario, setNombreUsuario] = useState('');
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();


  type Usuario = {
    tablerosJugados: number;
    rachaPuzzleDiario: number;
    rachaCarrusel: number;
    maximaPuntuacion: number;
    maxPuntuacionDiario: number;
    maxPuntuacionCarrusel: number;
    maxPuntuacionLibre: number;
    progresoPokedex: number;
  };

  const TOTAL_POKEMONS = 1300;

  useEffect(() => {
    const fetchUserData = async () => {
      const auth = getAuth();
      const firestore = getFirestore();
      const user = auth.currentUser;

      if (!user) return;

      try {
        setLoadingPokemons(true); // Activamos el loading

        // Leer datos del usuario
        const userDocRef = doc(firestore, "Usuarios", user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userData = userDocSnap.data();

          // Leer pokedex del usuario
          const pokedexDocRef = doc(firestore, "Pokedex", user.uid);
          const pokedexDocSnap = await getDoc(pokedexDocRef);

          let idsDesbloqueados: number[] = [];

          if (pokedexDocSnap.exists()) {
            const data = pokedexDocSnap.data();
            idsDesbloqueados = data.pokemons;
          }

          setPokemonsDesbloqueados(idsDesbloqueados);

          const progreso = Math.round((idsDesbloqueados.length / TOTAL_POKEMONS) * 100);

          const usuario: Usuario = {
            tablerosJugados: userData.tablerosJugados,
            rachaPuzzleDiario: userData.rachaDiaria,
            rachaCarrusel: userData.rachaCarrusel,
            maximaPuntuacion: userData.puntuacionMax,
            maxPuntuacionDiario: userData.puntuacionMaxDiario,
            maxPuntuacionCarrusel: userData.puntuacionMaxCarrusel,
            maxPuntuacionLibre: userData.puntuacionMaxLibre,
            progresoPokedex: progreso,
          };

          setUsuario(usuario);
        } else {
          console.log("No se encontró usuario en Firestore.");
        }
      } catch (error) {
        console.error("Error al obtener datos del usuario:", error);
      } finally {
        setLoadingPokemons(false); // Finalizamos el loading
      }
    };

    fetchUserData();
  }, []);

  useEffect(() => {
    const auth = getAuth();
    const db = getFirestore();
    const user = auth.currentUser;

    if (user) {
      const userDoc = doc(db, 'Usuarios', user.uid);
      getDoc(userDoc).then((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setNombreUsuario(data?.nombre || '');
        }
      });
    }
  }, []);

  useEffect(() => {
    if (tabActivo === 'Pokémons' && pokemons.length === 0) {
      fetchPokemons();
    }
  }, [tabActivo]);

  const fetchPokemons = async () => {
    if (loading || !hasMore) return;
    setLoading(true);
    try {
      const response = await fetch(`https://pokeapi.co/api/v2/pokemon?offset=${offset}&limit=50`);
      const data = await response.json();

      const detalles: Pokemon[] = await Promise.all(
        data.results.map(async (p: { url: string }) => {
          const res = await fetch(p.url);
          return await res.json();
        })
      );

      setPokemons(prev => [...prev, ...detalles]);
      setOffset(prev => prev + 50);
      setHasMore(Boolean(data.next));
    } catch (error) {
      console.error('Error al cargar los pokémons', error);
    } finally {
      setLoading(false);
    }
  };

  const pokemonsFiltrados = valorFiltro
  ? pokemons.filter((p) => {
      if (tipoFiltro === 'tipo' && valorFiltro) {
        return p.types?.some((t) => t.type.name === valorFiltro);
      } else if (tipoFiltro === 'especial' && valorFiltro) {
        if (valorFiltro === 'mega') {
          return (
            p.name.includes('-mega') &&
            p.sprites?.front_default // solo si tiene sprite
          );
        }
        if (valorFiltro === 'gmax') {
          return (
            p.name.includes('gmax') &&
            p.sprites?.front_default
          );
        }
      } else if (tipoFiltro === 'region' && valorFiltro) {
        const nombreRegion = valorFiltro.toLowerCase();

        // Lógica para las regiones y formas regionales
        if (nombreRegion === 'kanto') return p.id <= 151;
        if (nombreRegion === 'johto') return (p.id > 151 && p.id <= 251);
        if (nombreRegion === 'hoenn') return (p.id > 251 && p.id <= 386);
        if (nombreRegion === 'sinnoh') return (p.id > 386 && p.id <= 493);
        if (nombreRegion === 'unova') return (p.id > 493 && p.id <= 649);
        if (nombreRegion === 'kalos') return (p.id > 649 && p.id <= 721);
        if (nombreRegion === 'alola') return (p.id > 721 && p.id <= 809) || p.name.includes('-alola');
        if (nombreRegion === 'galar') return (p.id > 809 && p.id <= 905) || p.name.includes('-galar') || p.name.includes('-hisui');
        if (nombreRegion === 'paldea') return (p.id > 905 && p.id <= 1025) || p.name.includes('-paldea');
        return false;
      }
      return true;
    })
  : pokemons;

  const openModalConInfo = async (pokemon: any) => {
    const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokemon.id}`);
    const data = await res.json();

    const speciesRes = await fetch(data.species.url); // url para species
    const speciesData = await speciesRes.json();

    const generacion = speciesData.generation.name; // ej. "generation-i"

    const generacionARegion: Record<string, string> = {
      'generation-i': 'Kanto',
      'generation-ii': 'Johto',
      'generation-iii': 'Hoenn',
      'generation-iv': 'Sinnoh',
      'generation-v': 'Unova', 
      'generation-vi': 'Kalos',
      'generation-vii': 'Alola',
      'generation-viii': 'Galar',
      'generation-ix': 'Paldea',
    };

    const region = generacionARegion[generacion] || 'Desconocida';

    setPokemonSeleccionado({
      ...data,
      region,
    });
    setModalVisible(true);
  };


  const tiposInglesEspañol: { [key: string]: string } = {
    normal: 'Normal',
    fire: 'Fuego',
    water: 'Agua',
    electric: 'Eléctrico',
    grass: 'Planta',
    ice: 'Hielo',
    fighting: 'Lucha',
    poison: 'Veneno',
    ground: 'Tierra',
    flying: 'Volador',
    psychic: 'Psíquico',
    bug: 'Bicho',
    rock: 'Roca',
    ghost: 'Fantasma',
    dragon: 'Dragón',
    dark: 'Siniestro',
    steel: 'Acero',
    fairy: 'Hada',
  };

  const traducirYCapitalizarTipo = (tipoIngles: string): string => {
    const tipo = tiposInglesEspañol[tipoIngles.toLowerCase()] || tipoIngles;
    return tipo.charAt(0).toUpperCase() + tipo.slice(1);
  };

  const pokemonsFiltradosSinDuplicados = Array.from(
    new Map(pokemonsFiltrados.map(p => [p.name, p])).values()
  ).filter(p => p.sprites?.front_default);

  
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        
        <Text style={styles.title}>
          {nombreUsuario ? `Pokédex de ${nombreUsuario}` : 'Pokédex'}
        </Text>

        <TouchableOpacity onPress={() => router.push('/')}>
            <Image
              source={require('../assets/images/tfg/back.png')}
              style={{ width: 34, height: 34, left:340,top:-42, position:'absolute' }}
            />
        </TouchableOpacity>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity onPress={() => setTabActivo('Datos')} style={styles.tab}>
            <Text style={[styles.tabText, tabActivo === 'Datos' && styles.tabTextActive]}>
              Datos
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setTabActivo('Pokémons')} style={styles.tab}>
            <Text style={[styles.tabText, tabActivo === 'Pokémons' && styles.tabTextActive]}>
              Pokémons
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.fullLine} />

        {/* Contenido */}
        {tabActivo === 'Datos' ? (
          <View>
            <Text style={styles.infoText}>Tableros jugados: {usuario?.tablerosJugados}</Text>
            <Text style={styles.infoText}>Racha Puzzle Diario: {usuario?.rachaPuzzleDiario}</Text>
            <Text style={styles.infoText}>Racha Carrusel: {usuario?.rachaCarrusel}</Text>
            <Text style={styles.infoText}>Máxima Puntuación:{usuario?.maximaPuntuacion}</Text>
            <Text style={styles.infoText}>Max.Puntuación Diario: {usuario?.maxPuntuacionDiario}</Text>
            <Text style={styles.infoText}>Max.Puntuación Carrusel: {usuario?.maxPuntuacionCarrusel}</Text>
            <Text style={styles.infoText}>Max.Puntuación Libre: {usuario?.maxPuntuacionLibre}</Text>
            <Text style={styles.infoText}>Progreso Pokedex: {usuario?.progresoPokedex} %</Text>
          </View>
        ) : (
          <>
            {/* Filtros */}
            <View style={styles.filtroContainer}>
              <TouchableOpacity
                  style={[styles.filtroBoton, tipoFiltro === 'region' ? { backgroundColor: Colors.Iconos } : null]}
                  onPress={() => setTipoFiltro(prev => (prev === 'region' ? null : 'region'))}
                >
                  <Text style={[styles.filtroTexto]}>
                    Regiones
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filtroBoton, tipoFiltro === 'tipo' ? { backgroundColor: Colors.Iconos } : null]}
                  onPress={() => setTipoFiltro(prev => (prev === 'tipo' ? null : 'tipo'))}
                >
                  <Text style={[styles.filtroTexto]}>
                    Tipos
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.filtroBoton, tipoFiltro === 'especial' ? { backgroundColor: Colors.Iconos } : null]}
                  onPress={() => setTipoFiltro(prev => (prev === 'especial' ? null : 'especial'))}
                >
                  <Text style={[styles.filtroTexto]}>
                    Especiales
                  </Text>
                </TouchableOpacity>
              <TouchableOpacity style={styles.limpiarBoton} onPress={() =>{setTipoFiltro(null); setValorFiltro(null)} }>
                <Image source={require('../assets/images/tfg/filtrar.png')}
                style={styles.clearIcon}></Image>
              </TouchableOpacity>
            </View>

            {tipoFiltro === 'region' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 10, maxHeight: 60,top:-2,left:-10,height:70}}
                contentContainerStyle={{ alignItems: 'center',paddingLeft: 10}}
              >
                {regiones.map((r) => (
                  <TouchableOpacity
                    key={r}
                    onPress={() => setValorFiltro(r.toLowerCase())}
                    style={[
                      styles.filtroBoton,
                      valorFiltro === r.toLowerCase() ? { backgroundColor: Colors.Iconos } : null
                    ]}
                  >
                    <Text style={styles.filtroTexto}>{r}</Text>
                  </TouchableOpacity>

                ))}
              </ScrollView>
            )}

            {tipoFiltro === 'tipo' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 10, maxHeight: 60,height:70,left:-10,top: 5 }}
                contentContainerStyle={{ alignItems: 'center',paddingLeft: 10}}
                >
                  {tipos.map((t: Tipo) => (
                    <TouchableOpacity
                      key={t}
                      onPress={() => setValorFiltro(t)}
                      style={[
                        styles.filtroBoton,
                        valorFiltro === t ? { backgroundColor: Colors.Iconos } : null
                      ]}
                    >
                      <Text style={styles.filtroTexto}>{tiposTraduccion[t]}</Text>
                    </TouchableOpacity>

                ))}
              </ScrollView>
            )}


            {tipoFiltro === 'especial' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 10, maxHeight: 60,height:70,left:-10,top:5 }}
                contentContainerStyle={{ alignItems: 'center',paddingLeft: 10}}
              >
                {especiales.map((e) => (
                  <TouchableOpacity
                    key={e}
                    onPress={() => setValorFiltro(e)}
                    style={[
                      styles.filtroBoton,
                      valorFiltro === e ? { backgroundColor: Colors.Iconos } : null
                    ]}
                  >
                    <Text style={styles.filtroTexto}>{e}</Text>
                  </TouchableOpacity>

                ))}
              </ScrollView>
            )}


            {/* Sprites */}
              {loadingPokemons ? (
                <Text style={styles.infoTextcentrado}>Cargando pokemons desbloqueados...</Text>
              ) : (
                <FlatList
                  data={pokemonsFiltradosSinDuplicados}
                  keyExtractor={(item) => item.name}
                  numColumns={5}
                  contentContainerStyle={styles.pokemonGrid}
                  renderItem={({ item }) => {
                    const estaDesbloqueado = pokemonsDesbloqueados.includes(item.id);
                    if (!item.sprites.front_default) return null;
                    return (
                      <TouchableOpacity
                        disabled={!estaDesbloqueado}
                        onPress={() => estaDesbloqueado && openModalConInfo(item)}
                        style={{ margin: 5, opacity: estaDesbloqueado ? 1 : 0.7 }}
                      >
                        <Image
                          source={{ uri: item.sprites.front_default }}
                          style={{ width: 60, height: 60, tintColor: estaDesbloqueado ? undefined : Colors.Botones_menu }}
                        />

                      </TouchableOpacity>
                    );
                  }}
                  onEndReached={fetchPokemons}
                  onEndReachedThreshold={0.5}
                  ListFooterComponent={loading ? <Text style={styles.infoTextcentrado}>Cargando más...</Text> : null}
                />
              )}
          </>
        )}
      </View>
      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.7)',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
        }}>
          <View style={{
            backgroundColor: Colors.Fondo,
            borderRadius: 10,
            padding: 20,
            width: '90%',
            maxHeight: '80%',
          }}>
            {pokemonSeleccionado ? (
              <>
                <Text style={[styles.infopokemon, { textAlign: 'center' }]}>
                  {pokemonSeleccionado.name.toUpperCase()}
                </Text>
                <Image
                  source={{ uri: pokemonSeleccionado.sprites.front_default }}
                  style={{ width: 150, height: 150, alignSelf: 'center' }}
                />
                <Text style={styles.infopokemon}>
                  Tipo: {pokemonSeleccionado.types.map((t: any) => traducirYCapitalizarTipo(t.type.name)).join(' - ')}
                </Text>
                <Text style={styles.infopokemon}>Altura: {pokemonSeleccionado.height / 10} m</Text>
                <Text style={styles.infopokemon}>Peso: {pokemonSeleccionado.weight / 10} kg</Text>
                <Text style={styles.infopokemon}>Región: {pokemonSeleccionado?.region}</Text>
                
                <TouchableOpacity
                  onPress={() => setModalVisible(false)}
                  style={{
                    marginTop: 20,
                    backgroundColor: Colors.Botones_menu,
                    padding: 10,
                    borderRadius: 5,
                  }}
                >
                  <Text style={{ color: Colors.blanco, textAlign: 'center', fontFamily:'Pixel' }}>Cerrar</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text>Cargando...</Text>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default PokedexScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.Fondo,
    padding: 16,
  },
  card: {
    flex: 1,
    backgroundColor: Colors.Fondo,
    padding: 10,
  },
  title: {
    fontFamily: 'Pixel',
    fontSize: 30,
    color: Colors.blanco,
    marginBottom: 10,
    textAlign: 'left',
    marginLeft: -20,
  },
  tabsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  tab: {
    marginHorizontal: 50,
    borderBottomColor: Colors.blanco,
  },
  tabText: {
    fontFamily: 'Pixel',
    fontSize: 25,
    color: Colors.blanco,
    margin: 20,
  },
  tabTextActive: {
    color: Colors.blanco,
    textDecorationLine: 'underline',
  },
  infoText: {
    color: Colors.blanco,
    fontFamily: 'Pixel',
    marginVertical: 25,
    fontSize: 23,
  },
  infoTextcentrado: {
    color: Colors.blanco,
    fontFamily: 'Pixel',
    marginVertical: 25,
    fontSize: 23,
    textAlign: 'center',
  },
  fullLine: {
    height: 2,
    backgroundColor: Colors.blanco,
    width: '130%',
    top: -28,
    marginLeft: -50,
  },
  pokemonGrid: {
    flexDirection: 'column',
    justifyContent: 'center',
    marginTop:20,
    paddingBottom:30,
  },
  pokemonSprite: {
    width: 60,
    height: 60,
    margin: 5,
    tintColor: Colors.Botones_menu,
  },
  filtroContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: 10,
    gap:10,
  },
  filtroBoton: {
    backgroundColor: Colors.Botones_menu,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 20,
    marginRight: 10,
    height: 40, // asegúrate de que esto sea el mismo en todos
    justifyContent: 'center',
},
  limpiarBoton: {
    backgroundColor: Colors.Iconos,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    justifyContent:'center'
  },
  filtroTexto: {
  color: 'white',
  fontFamily:'Pixel',
  textTransform: 'capitalize',
},
  clearIcon: {
  width: 20,
  height: 20,
  tintColor: Colors.blanco, // Opcional, solo si quieres aplicar color
},
  pokemonBloqueado: {
    tintColor: Colors.Botones_menu,  // o un filtro que oscurezca la imagen
  },
  infopokemon:{
    color: Colors.blanco,
    fontFamily: 'Pixel',
    fontSize:20,
    paddingVertical:3
  },
});
