import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Modal, TextInput, FlatList, ActivityIndicator,ImageBackground} from 'react-native';
import { tiposCombinables, regionesPosibles, typeStyles, abrirInfo, getBallImageCarrusel } from './funciones_aux';
import { Colors } from '@/themes/Colors';
import { useNavigation } from '@react-navigation/native';
import { getDoc, doc, updateDoc, setDoc, arrayUnion } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { auth, db } from '@/FireBaseconfig';


const inicializaTableroVacio = () => {
    return Array(3).fill(null).map(() => Array(3).fill(null));
};

export default function Diario() {
    const navigation = useNavigation();
    const [topLabels, setTopLabels] = useState<string[]>([]);
    const [leftLabels, setLeftLabels] = useState<string[]>([]);
    const [sprites, setSprites] = useState<{ [key: number]: string }>({});
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [errorModal, setErrorModal] = useState({ visible: false, message: '' });
    const [allPokemonNames, setAllPokemonNames] = useState<string[]>([]);
    const [pokemonSprites, setPokemonSprites] = useState<{ [name: string]: string }>({});
    const [board, setBoard] = useState(Array(3).fill(null).map(() => Array(3).fill(null)));
    const regions = ['Kanto', 'Johto', 'Hoenn', 'Sinnoh', 'Teselia', 'Kalos', 'Alola', 'Galar', 'Paldea', 'Hisui'];
    const [startTime, setStartTime] = useState<Date | null>(null);
    const [score, setScore] = useState(0);
    const [remainingTime, setRemainingTime] = useState(150);
    const [timeOutModalVisible, setTimeOutModalVisible] = useState(false);
    const [boardCompletedModalVisible, setBoardCompletedModalVisible] = useState(false);
    const [lives, setLives] = useState(2);
    const [surrenderModal, setsurrenderModal] = useState(false);
    const [contador, setContador] = useState(0);
    const [gameOverModalVisible, setGameOverModalVisible] = useState(false);
    const [infoVisible, setInfoVisible] = useState(false);
    const usuario = auth.currentUser;
    const [spritesCargados, setSpritesCargados] = useState(false);

    useEffect(() => {
        if (!startTime) {
            setStartTime(new Date());
        }
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setRemainingTime(prev => {
                if (prev <= 0) {
                    clearInterval(interval);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval); // Limpiar al desmontar
    }, []);

    useEffect(() => {
        if (remainingTime <= 0) {
            setTimeOutModalVisible(true);
        }
    }, [remainingTime]);

    useEffect(() => {
        if (isBoardComplete()) {
            setBoardCompletedModalVisible(true);
        }
    }, [board]);



    const formatTime = (seconds: number) => {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const generarNuevasEtiquetas = () => {
        const nuevas = ficha_random();
        if (nuevas) {
            setTopLabels(nuevas.top);
            setLeftLabels(nuevas.left);
        }
    };

    const actualizarRecordCarrusel = async (tablerosCompletados: number, puntuacionFinal: number) => {
        const user = getAuth().currentUser;
        if (!user?.uid) return console.warn("No hay usuario logueado.");

        const docRef = doc(db, "Usuarios", user.uid);
        const snapshot = await getDoc(docRef);

        if (!snapshot.exists()) {
            console.warn("El documento del usuario no existe.");
            return;
        }

        const data = snapshot.data();
        const recordAnterior = data.rachaCarrusel;
        const puntuacionMaxima = data.puntuacionMaxCarrusel;
        const puntuacionMaxGeneral = data.puntuacionMax;
        const tablerosJugados = data.tablerosJugados;

        const updates: any = { tablerosJugados: tablerosJugados + 1 };
        if (tablerosCompletados > recordAnterior) {
            updates.rachaCarrusel = tablerosCompletados;
        }

        if (puntuacionFinal > puntuacionMaxima) {
            updates.puntuacionMaxCarrusel = puntuacionFinal;
        }

        if (puntuacionFinal > puntuacionMaxGeneral) {
            updates.puntuacionMax = puntuacionFinal;
        }

        if (Object.keys(updates).length > 0) {
            await updateDoc(docRef, updates);
            console.log("Datos actualizados correctamente:", updates);
        } else {
            console.log("No hay récords que superar.");
        }
    };

    const añadirPokemonADex = async (usuarioID: string, pokemonID: number) => {
        const docRef = doc(db, "Pokedex", usuarioID);
        try {
            const snapshot = await getDoc(docRef);

            if (!snapshot.exists()) {

                await setDoc(docRef, {
                    pokemons: [pokemonID]
                });
                console.log("Documento creado y Pokémon añadido:", pokemonID);
            } else {

                await updateDoc(docRef, {
                    pokemons: arrayUnion(pokemonID)
                });
                console.log("Pokémon añadido al array:", pokemonID);
            }
        } catch (error) {
            console.error("Error al añadir Pokémon al documento Pokedex:", error);
        }
    };

    useEffect(() => {
        const fetchAllPokemon = async () => {
            try {
                const res = await fetch('https://pokeapi.co/api/v2/pokemon?limit=1300');
                const data = await res.json();
                const names = data.results.map((p: any) => p.name);
                setAllPokemonNames(names);
            } catch (e) {
                console.error('Error cargando todos los nombres de Pokémon', e);
            }
        };
        fetchAllPokemon();
    }, []);

    useEffect(() => {
        const { top, left } = ficha_random();
        setTopLabels(top);
        setLeftLabels(left);
    }, []);

    const isBoardComplete = () => {
        for (let row = 0; row < 3; row++) {
            for (let col = 0; col < 3; col++) {
                if (!board[row][col]) {
                    return false;
                }
            }
        }
        return true;
    };

    const handleCellPress = (index: number) => {
        setSelectedIndex(index);
        setQuery('');
        setResults([]);
        setModalVisible(true);
    };

    const handleSelect = async (
        pokemon: any,
        regions: string[],
        leftLabels: string[],
        topLabels: string[]
    ) => {
        if (selectedIndex === null) return;

         // Comprobar si el Pokémon ya está en el tablero
        const estaRepetido = (pokemon: any) => {
            return board.some(fila => fila.some(celda => celda?.id === pokemon.id));
        };

        if (estaRepetido(pokemon)) {
            setErrorModal({
                visible: true,
                message: `Este Pokémon ya ha sido usado en otra casilla.`
            });
            return;
        }

        const row = Math.floor(selectedIndex / 3);
        const col = selectedIndex % 3;

        const labelFila = leftLabels[row];
        const labelColumna = topLabels[col];

        const tiposEspanolIngles: { [key: string]: string } = {
            'Agua': 'water', 'Fuego': 'fire', 'Planta': 'grass', 'Electrico': 'electric',
            'Hielo': 'ice', 'Tierra': 'ground', 'Bicho': 'bug', 'Fantasma': 'ghost',
            'Roca': 'rock', 'Acero': 'steel', 'Dragon': 'dragon', 'Hada': 'fairy',
            'Lucha': 'fighting', 'Normal': 'normal', 'Veneno': 'poison', 'Psiquico': 'psychic',
            'Siniestro': 'dark', 'Volador': 'flying',
        };

        const sufijosRegionales: { [key: string]: string } = {
            'Alola': '-alola',
            'Galar': '-galar',
            'Hisui': '-hisui',
            'Paldea': '-paldea',
        };

        const hisuiPokemons = [
            'kleavor', 'ursaluna', 'basculegion', 'overqwil', 'sneasler',
            'wyrdeer'
        ];

        const formatLabel = (label: string) =>
            label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();

        const formattedFila = formatLabel(labelFila);
        const formattedColumna = formatLabel(labelColumna);

        const tipoFila = tiposEspanolIngles[formattedFila];
        const tipoColumna = tiposEspanolIngles[formattedColumna];

        const filaEsRegion = regions.includes(formattedFila);
        const columnaEsRegion = regions.includes(formattedColumna);

        const speciesRes = await fetch(pokemon.species.url);
        const speciesData = await speciesRes.json();
        const generation = speciesData.generation.name;

        const genToRegion: { [key: string]: string } = {
            'generation-i': 'Kanto',
            'generation-ii': 'Johto',
            'generation-iii': 'Hoenn',
            'generation-iv': 'Sinnoh',
            'generation-v': 'Teselia',
            'generation-vi': 'Kalos',
            'generation-vii': 'Alola',
            'generation-viii': 'Galar',
            'generation-ix': 'Paldea',
            'generation-x': 'Hisui',
        };

        const regionPokemon = genToRegion[generation];
        const tiposPokemon = pokemon.types.map((t: any) => t.type.name.toLowerCase());
        const nombrePokemon = pokemon.name.toLowerCase();

        let valido = false;

        const cumpleConTipos = (tipos: string[]) => {
            return tipos.some((tipo: string) => tipo === tipoFila || tipo === tipoColumna);
        };

        const esFormaMega = formattedFila === 'Mega' || formattedColumna === 'Mega';
        const esFormaGmax = formattedFila === 'G-max' || formattedColumna === 'G-max';

        if (filaEsRegion && columnaEsRegion) {
            valido = false; // No se permiten combinaciones de dos regiones
        } else if (filaEsRegion || columnaEsRegion) {
            const tipo = filaEsRegion ? tipoColumna : tipoFila;
            const region = filaEsRegion ? formattedFila : formattedColumna;

            const sufijoEsperado = sufijosRegionales[region];
            const esFormaRegional = sufijoEsperado && nombrePokemon.includes(sufijoEsperado);
            const esNativoDeRegion = regionPokemon === region || (region === 'Hisui' && hisuiPokemons.includes(nombrePokemon));
            

            valido = tiposPokemon.includes(tipo) && (esFormaRegional || esNativoDeRegion);
        } else if (esFormaMega || esFormaGmax) {
            // Casillas especiales que piden Mega o Gmax
            if (esFormaMega && nombrePokemon.includes('-mega')) {
                valido = cumpleConTipos(tiposPokemon);
            } else if (esFormaGmax && nombrePokemon.includes('-gmax')) {
                valido = cumpleConTipos(tiposPokemon);
            } else {
                valido = false;
            }
        } else {
            // Casillas normales (ni Mega ni Gmax)
            if (tipoFila && tipoColumna && tipoFila !== tipoColumna) {
                // Si ambos son tipos distintos, debe tener AMBOS
                valido = tiposPokemon.includes(tipoFila) && tiposPokemon.includes(tipoColumna);
            } else {
                // Si solo hay un tipo (porque la otra etiqueta es región u otra cosa), vale con que tenga uno
                valido = cumpleConTipos(tiposPokemon);
            }
        }

        // Validaciones extra por forma
        if (esFormaMega && !nombrePokemon.includes('-mega')) {
            valido = false;
        }

        if (esFormaGmax && !nombrePokemon.includes('-gmax')) {
            valido = false;
        }

        if (!valido) {
            setLives(prev => prev - 1);
            setErrorModal({
                visible: true,
                message: `Este Pokémon no cumple con los requisitos:\n• ${labelFila}\n• ${labelColumna}`
            });

            if (lives - 1 <= 0) {
                setGameOverModalVisible(true);
            }
            return;
        }

        if (board[row][col]) return;

        const now = new Date();
        const elapsedSeconds = Math.floor((now.getTime() - (startTime?.getTime() || 0)) / 1000);
        const totalDuration = 120; // 2 minutos = 120 segundos
        const remainingSeconds = Math.max(0, totalDuration - elapsedSeconds);

        // Calculamos el extra proporcional (por ejemplo: 90s => 1.5)
        const timeMultiplier = remainingSeconds / 60; // para que 60s = 1.0, 120s = 2.0

        // Puntos: 100 base + extra proporcional al tiempo
        const basePoints = 100;
        const extraPoints = Math.floor(timeMultiplier * 100);

        const totalPoints = basePoints + extraPoints;
        const newScore = score + totalPoints;
        setScore(newScore);

        const newBoard = [...board];
        newBoard[row][col] = pokemon;
        setBoard(newBoard);

        await añadirPokemonADex(usuario?.uid!, pokemon.id);

        if (isBoardComplete()) {
            setBoardCompletedModalVisible(true);
            
            const nuevoContador = contador + 1;
            setContador(nuevoContador);
            actualizarRecordCarrusel(nuevoContador, newScore);

        }

        const sprite = pokemon.sprites.front_default;
        if (sprite) {
            setSprites(prev => ({
                ...prev,
                [selectedIndex]: sprite
            }));
        }

        setModalVisible(false);
    };


    const resetGame = () => {
        setBoard(inicializaTableroVacio());
        setSprites(Array(9).fill(null));
        setStartTime(new Date());
    };

    const ficha_random = () => {
        const especiales = ['Mega', 'G-max'];
        const regionesBase = Object.keys(regionesPosibles);
        const regionesProbabilidad = [
            ...regionesBase,
            'Mega', 'G-max', 'Mega', 'Mega', 'G-max', 'G-max', 'Mega', 'Mega', 'G-max', 'Mega', 'Mega', 'G-max', 'G-max', 'Mega' // duplicados solo para aumentar la probabilidad
        ];
        const tipos: string[] = Object.keys(tiposCombinables).map(t =>
            t.charAt(0).toUpperCase() + t.slice(1)
        );

        const copiaRegions = [...regionesProbabilidad];
        const copiaTipos = [...tipos];
        const yaIncluidos = new Set<string>();

        const incluirRegion = Math.random() < 0.5;
        const filasTienenRegiones = Math.random() < 0.5;

        let topLabels: string[] = [];
        let leftLabels: string[] = [];

        const shuffleArray = (array: string[]) => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        };

        const extraerEtiqueta = (arr: string[]): string => {
            while (arr.length > 0) {
                const index = Math.floor(Math.random() * arr.length);
                const etiqueta = arr.splice(index, 1)[0];
                if (especiales.includes(etiqueta)) {
                    if (yaIncluidos.has(etiqueta)) continue; // Evita duplicados
                    yaIncluidos.add(etiqueta);
                }
                return etiqueta;
            }
            return '';
        };

        const esCombinacionValida = (fila: string, columna: string): boolean => {
            if ((fila === 'Mega' && columna === 'G-max') || (fila === 'G-max' && columna === 'Mega')) {
                return false;
            }

            const filaLower = fila.toLowerCase();
            const colLower = columna.toLowerCase();

            const filaEsRegion = regionesPosibles[fila] !== undefined || especiales.includes(fila);
            const colEsRegion = regionesPosibles[columna] !== undefined || especiales.includes(columna);

            if (filaEsRegion && colEsRegion) return false;

            if (filaEsRegion) return !especiales.includes(fila) || tiposCombinables[colLower] !== undefined;
            if (colEsRegion) return !especiales.includes(columna) || tiposCombinables[filaLower] !== undefined;

            return tiposCombinables[filaLower]?.includes(colLower) ?? false;
        };

        if (incluirRegion) {
            if (filasTienenRegiones) {
                const left: string[] = [];

                const numRegiones = Math.random() < 0.5 ? 1 : 2;
                for (let i = 0; i < numRegiones; i++) {
                    left.push(extraerEtiqueta(copiaRegions));
                }

                while (left.length < 3) {
                    left.push(extraerEtiqueta(copiaTipos));
                }

                leftLabels = shuffleArray(left);

                while (topLabels.length < 3) {
                    topLabels.push(extraerEtiqueta(copiaTipos));
                }
            } else {
                const top: string[] = [];

                const numRegiones = Math.random() < 0.5 ? 1 : 2;
                for (let i = 0; i < numRegiones; i++) {
                    top.push(extraerEtiqueta(copiaRegions));
                }

                while (top.length < 3) {
                    top.push(extraerEtiqueta(copiaTipos));
                }

                topLabels = shuffleArray(top);

                while (leftLabels.length < 3) {
                    leftLabels.push(extraerEtiqueta(copiaTipos));
                }
            }
        } else {
            // Solo tipos
            const todosLosTipos = Object.keys(tiposCombinables);
            const columnas = shuffleArray([...todosLosTipos]).slice(0, 3);

            const filasValidas = todosLosTipos.filter(tipo =>
                columnas.every(col => esCombinacionValida(tipo, col))
            );

            if (filasValidas.length < 3) return ficha_random();

            const filas = shuffleArray(filasValidas).slice(0, 3);

            topLabels = columnas.map(t => t.charAt(0).toUpperCase() + t.slice(1));
            leftLabels = filas.map(t => t.charAt(0).toUpperCase() + t.slice(1));
        }

        const esCuadriculaValida = leftLabels.every(fila =>
            topLabels.every(col => esCombinacionValida(fila, col))
        );

        if (!esCuadriculaValida) {
            return ficha_random();
        }

        return { top: topLabels, left: leftLabels };
    };

    const ballImage = getBallImageCarrusel(score);
    let imageSize = 60;

    if (score >= 1500 && score < 6000) {
        imageSize = 45;
    } 

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Carrusel</Text>
                <TouchableOpacity onPress={() => setInfoVisible(true)}>
                    <Image source={require('../assets/images/tfg/help.png')} style={styles.infoIcon} />
                </TouchableOpacity>
            </View>

            <View style={[styles.scoreContainer]}>
                <Text style={[styles.scoreText, { top: -40 }]}>Puntuación: {score}</Text>
                <Image
                    source={ballImage}
                    style={[styles.scoreIcon, { top: -40, width: imageSize, height: imageSize }]}
                />
                <Text style={[styles.timerText, { top: -26 }]}>{formatTime(remainingTime)}</Text>
                <Text style={[styles.timerText, { top: 35, marginRight: 146 }]}>Racha Tableros: {contador}</Text>
            </View>

            <View style={[styles.pikachuContainer, { left: 25, top: 260 }]}>
                <Image
                    source={require('../assets/images/tfg/pikachu.png')}
                    style={[
                        styles.pikachu,
                        lives < 2 && styles.pikachuOscuro,
                    ]}
                />
            </View>


            <View style={styles.gridContainer}>
                {/* Fila superior con las etiquetas */}
                <View style={styles.row}>
                    <View style={styles.corner} />
                    {topLabels.map((label, idx) => {
                        const tipo = label?.toLowerCase();
                        const style = typeStyles[tipo] || { backgroundColor: '#ccc', color: '#000' };
                        const isMega = tipo === 'mega';

                        return (
                            <TouchableOpacity
                                key={idx}
                                style={{ marginRight: 6, marginBottom: 12, marginLeft: 18 }}
                                onPress={() => abrirInfo(label)}
                            >
                                {isMega ? (
                                    <ImageBackground
                                        source={require('../assets/images/tfg/arcoiris.jpg')}
                                        resizeMode="cover"
                                        style={{
                                            paddingVertical: 6,
                                            paddingHorizontal: 10,
                                            borderRadius: 10,
                                            overflow: 'hidden',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            minWidth: 80,
                                        }}
                                        imageStyle={{
                                            borderRadius: 10,
                                        }}
                                    >
                                        <Text
                                            style={{
                                                fontFamily: 'Pixel',
                                                fontSize: 16,
                                                color: '#000',
                                                textAlign: 'center',
                                            }}
                                        >
                                            {label}
                                        </Text>
                                    </ImageBackground>
                                ) : (
                                    <Text
                                        style={{
                                            backgroundColor: style.backgroundColor,
                                            color: style.color,
                                            paddingVertical: 6,
                                            borderRadius: 10,
                                            fontFamily: 'Pixel',
                                            fontSize: 16,
                                            textAlign: 'center',
                                            minWidth: 80,
                                        }}
                                    >
                                        {label}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* Fila del tablero con las etiquetas a la izquierda */}
                {Array.from({ length: 3 }).map((_, rowIdx) => (
                    <View key={rowIdx} style={styles.row}>
                        {/* Etiquetas de la izquierda */}
                        <TouchableOpacity
                            onPress={() => abrirInfo(leftLabels[rowIdx])}
                            style={{ marginRight: 5, marginLeft: -6 }}
                        >
                            {leftLabels[rowIdx]?.toLowerCase() === 'mega' ? (
                                <ImageBackground
                                    source={require('../assets/images/tfg/arcoiris.jpg')}
                                    resizeMode="cover"
                                    style={{
                                        width: 95,
                                        paddingVertical: 6,
                                        borderRadius: 10,
                                        overflow: 'hidden',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}
                                    imageStyle={{
                                        borderRadius: 10,
                                    }}
                                >
                                    <Text
                                        style={{
                                            fontFamily: 'Pixel',
                                            fontSize: 16,
                                            color: 'fff',
                                            textAlign: 'center',
                                        }}
                                    >
                                        {leftLabels[rowIdx]}
                                    </Text>
                                </ImageBackground>
                            ) : (
                                <Text
                                    style={{
                                        width: 95,
                                        textAlign: 'center',
                                        backgroundColor: typeStyles[leftLabels[rowIdx]?.toLowerCase()]?.backgroundColor || '#ccc',
                                        color: typeStyles[leftLabels[rowIdx]?.toLowerCase()]?.color || '#000',
                                        paddingVertical: 6,
                                        borderRadius: 10,
                                        fontFamily: 'Pixel',
                                        fontSize: 16,
                                    }}
                                >
                                    {leftLabels[rowIdx] || 'Tipo'}
                                </Text>
                            )}
                        </TouchableOpacity>

                        {/* Celdas del tablero */}
                        {Array.from({ length: 3 }).map((_, colIdx) => {
                            const index = rowIdx * 3 + colIdx;

                            return (
                                <TouchableOpacity
                                    key={colIdx}
                                    style={styles.cell}
                                    onPress={() => handleCellPress(index)}
                                    disabled={!!sprites[index]} // desactiva si ya hay un Pokémon
                                    activeOpacity={0.6} // da una sensación táctil suave
                                >
                                    {sprites[index] && (
                                        <Image source={{ uri: sprites[index] }} style={{ width: 85, height: 85 }} />
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                ))}
            </View>

            <TouchableOpacity
                style={styles.surrenderButton}
                onPress={() => setsurrenderModal(true)}
            >
                <Text style={styles.surrenderText}>Rendirse</Text>
            </TouchableOpacity>

            {/* Modal de búsqueda */}
            <Modal visible={modalVisible} animationType="slide">
                <View style={{ flex: 1, backgroundColor: Colors.Fondo, padding: 20 }}>
                    <Text style={{ color: Colors.blanco, fontSize: 20, fontFamily: 'Pixel', marginTop: 10 }}>
                        Buscar Pokémon
                    </Text>
                    <TextInput
                        style={{
                            backgroundColor: Colors.blanco,
                            marginVertical: 35,
                            borderRadius: 10,
                            paddingHorizontal: 10,
                            fontFamily: 'Pixel',
                            height: 50,
                            fontSize: 18,
                        }}
                        placeholder="Nombre del Pokémon"
                        onChangeText={(text) => {
                            setQuery(text);
                            setSpritesCargados(false); // empezar carga

                            const filtered = allPokemonNames
                                .filter((name) => name.toLowerCase().includes(text.toLowerCase()))
                                .slice(0, 20);

                            setResults(filtered);

                            Promise.all(
                                filtered.map(async (name) => {
                                    if (!pokemonSprites[name]) {
                                        try {
                                            const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${name}`);
                                            const data = await res.json();
                                            setPokemonSprites((prev) => ({
                                                ...prev,
                                                [name]: data.sprites.front_default,
                                            }));
                                        } catch (e) {
                                            console.error(`Error cargando sprite de ${name}`, e);
                                        }
                                    }
                                })
                            ).then(() => {
                                setSpritesCargados(true); // solo cuando TODOS estén listos
                            });
                        }}
                        value={query}
                    />
                    <TouchableOpacity
                        style={{
                            width: 150,
                            backgroundColor: Colors.Botones_menu,
                            padding: 10,
                            borderRadius: 10,
                            alignItems: 'center',
                            marginLeft: 115,
                            marginBottom: 40,
                        }}
                        onPress={() => setModalVisible(false)}
                    >
                        <Text
                            style={{
                                color: Colors.blanco,
                                fontSize: 18,
                                fontFamily: 'Pixel',
                            }}
                        >
                            Volver
                        </Text>
                    </TouchableOpacity>

                    {!spritesCargados ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={Colors.Botones_menu} />
                            <Text style={{ color: Colors.blanco, fontFamily: 'Pixel', marginTop: 10 }}>
                                Cargando Pokémon...
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={results}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    onPress={async () => {
                                        setLoading(true);
                                        try {
                                            const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${item}`);
                                            const data = await res.json();
                                            handleSelect(data, regions, leftLabels, topLabels);
                                        } catch (e) {
                                            console.error('Error al cargar Pokémon', e);
                                        }
                                        setLoading(false);
                                    }}
                                    style={[styles.row, { alignItems: 'center', padding: 10 }]}
                                >
                                    <Image source={{ uri: pokemonSprites[item] }} style={{ width: 80, height: 80 }} />
                                    <Text style={styles.typeLabel2}>
                                        {item.charAt(0).toUpperCase() + item.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                    )}

                </View>
            </Modal>

            {/* Modal de error */}
            <Modal
                visible={errorModal.visible}
                transparent
                animationType="fade"
                onRequestClose={() => setErrorModal({ visible: false, message: '' })}
            >
                <View
                    style={{
                        flex: 1,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <View
                        style={{
                            backgroundColor: Colors.Fondo,
                            padding: 24,
                            borderRadius: 20,
                            borderColor: Colors.Tablero,
                            borderWidth: 2,
                            maxWidth: '80%',
                        }}
                    >
                        <Text
                            style={{
                                fontFamily: 'Pixel',
                                fontSize: 16,
                                color: Colors.blanco,
                                textAlign: 'center',
                                marginBottom: 16,
                            }}
                        >
                            {errorModal.message}
                        </Text>
                        <TouchableOpacity
                            onPress={() => setErrorModal({ visible: false, message: '' })}
                            style={{
                                backgroundColor: Colors.Botones_menu,
                                paddingVertical: 8,
                                paddingHorizontal: 20,
                                borderRadius: 10,
                                alignSelf: 'center',
                            }}
                        >
                            <Text
                                style={{
                                    fontFamily: 'Pixel',
                                    fontSize: 14,
                                    color: Colors.blanco,
                                }}
                            >
                                Aceptar
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            {/* Modal rendirte*/}
            <Modal
                animationType="fade"
                transparent={true}
                visible={surrenderModal}
                onRequestClose={() => setsurrenderModal(false)}
            >
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <View style={{
                        backgroundColor: Colors.Fondo,
                        padding: 24,
                        borderRadius: 20,
                        borderColor: Colors.Tablero,
                        borderWidth: 2,
                        maxWidth: '80%'
                    }}>
                        <Text style={{
                            fontFamily: 'Pixel',
                            fontSize: 16,
                            color: Colors.blanco,
                            textAlign: 'center',
                            marginBottom: 16
                        }}>
                            ¿Estás seguro de que quieres rendirte?{'\n'}Perderás todo tu progreso.
                        </Text>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                            <TouchableOpacity
                                onPress={() => setsurrenderModal(false)}
                                style={{
                                    backgroundColor: Colors.Botones_menu,
                                    paddingVertical: 8,
                                    paddingHorizontal: 16,
                                    borderRadius: 10,
                                    marginRight: 10,
                                    flex: 1
                                }}
                            >
                                <Text style={{
                                    fontFamily: 'Pixel',
                                    fontSize: 14,
                                    color: Colors.blanco,
                                    textAlign: 'center'
                                }}>
                                    Cancelar
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => {
                                    setsurrenderModal(false);
                                    navigation.goBack(); // Aquí va la acción de rendirse
                                }}
                                style={{
                                    backgroundColor: Colors.Botones_menu,
                                    paddingVertical: 8,
                                    paddingHorizontal: 16,
                                    borderRadius: 10,
                                    flex: 1
                                }}
                            >
                                <Text style={{
                                    fontFamily: 'Pixel',
                                    fontSize: 14,
                                    color: Colors.blanco,
                                    textAlign: 'center'
                                }}>
                                    Rendirse
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Modal de tiempo agotado */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={timeOutModalVisible}
                onRequestClose={() => setTimeOutModalVisible(false)}
            >
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <View style={{
                        backgroundColor: Colors.Fondo,
                        padding: 24,
                        borderRadius: 20,
                        borderColor: Colors.Tablero,
                        borderWidth: 2,
                        maxWidth: '80%'
                    }}>
                        <Text style={{
                            fontFamily: 'Pixel',
                            fontSize: 16,
                            color: Colors.blanco,
                            textAlign: 'center',
                            marginBottom: 16
                        }}>
                            ¡Se acabó el tiempo!
                        </Text>
                        <TouchableOpacity
                            onPress={() => {
                                setTimeOutModalVisible(false);
                                navigation.goBack();
                                resetGame();
                            }}
                            style={{
                                backgroundColor: Colors.Botones_menu,
                                paddingVertical: 8,
                                paddingHorizontal: 20,
                                borderRadius: 10,
                                alignSelf: 'center'
                            }}
                        >
                            <Text style={{
                                fontFamily: 'Pixel',
                                fontSize: 14,
                                color: Colors.blanco
                            }}>
                                Volver al Menú
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            <Modal visible={boardCompletedModalVisible} transparent animationType="slide">
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <View style={{
                        backgroundColor: Colors.Fondo,
                        padding: 24,
                        borderRadius: 20,
                        borderColor: Colors.Tablero,
                        borderWidth: 2,
                        maxWidth: '80%'
                    }}>
                        <Text style={{
                            fontFamily: 'Pixel',
                            fontSize: 16,
                            color: Colors.blanco,
                            textAlign: 'center',
                            marginBottom: 16
                        }}>
                            ¡Tablero completado!
                        </Text>
                        <TouchableOpacity
                            onPress={() => {
                                // Cerrar el modal
                                setBoardCompletedModalVisible(false);
                                // Reiniciar tablero
                                resetGame();
                                // Generar nuevas etiquetas
                                generarNuevasEtiquetas();
                                // Reiniciar tiempo
                                setRemainingTime(150); // o lo que uses
                                setStartTime(new Date());
                                // Restaurar vida si falta alguna
                                if (lives < 2) {
                                    setLives(2);
                                }
                            }}
                            style={{
                                backgroundColor: Colors.Botones_menu,
                                paddingVertical: 8,
                                paddingHorizontal: 20,
                                borderRadius: 10,
                                alignSelf: 'center'
                            }}
                        >
                            <Text style={{
                                fontFamily: 'Pixel',
                                fontSize: 14,
                                color: Colors.blanco
                            }}>
                                Continuar
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            {/*Modal vidas perdidas*/}
            <Modal visible={gameOverModalVisible} transparent animationType="slide">
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <View style={{
                        backgroundColor: Colors.Fondo,
                        padding: 24,
                        borderRadius: 20,
                        borderColor: Colors.Tablero,
                        borderWidth: 2,
                        maxWidth: '80%'
                    }}>
                        <Text style={{
                            fontFamily: 'Pixel',
                            fontSize: 16,
                            color: Colors.blanco,
                            textAlign: 'center',
                            marginBottom: 16
                        }}>
                            ¡Te has quedado sin vidas!
                        </Text>

                        <TouchableOpacity
                            onPress={() => {
                                setGameOverModalVisible(false);
                                navigation.goBack();
                            }}
                            style={{
                                backgroundColor: Colors.Botones_menu,
                                paddingVertical: 8,
                                paddingHorizontal: 20,
                                borderRadius: 10,
                                alignSelf: 'center'
                            }}
                        >
                            <Text style={{
                                fontFamily: 'Pixel',
                                fontSize: 14,
                                color: Colors.blanco
                            }}>
                                Volver al menú
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            {/*Moda Informacion */}
            <Modal visible={infoVisible} transparent animationType="slide">
                <View style={{
                    flex: 1,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    justifyContent: 'center',
                    alignItems: 'center'
                }}>
                    <View style={{
                        backgroundColor: Colors.Fondo,
                        padding: 24,
                        borderRadius: 20,
                        borderColor: Colors.Tablero,
                        borderWidth: 2,
                        maxWidth: '80%'
                    }}>
                        <Text style={{
                            fontFamily: 'Pixel',
                            fontSize: 16,
                            color: Colors.blanco,
                            textAlign: 'center',
                            marginBottom: 16
                        }}>
                            ¡Saludos Jugador!{'\n'}{'\n'}
                            El modo Carrusel consiste en rellenar el tablero en menos de dos minutos y medio. Deberás hacerlo de forma continua, hasta donde seas capaz de llegar.{'\n'}
                            El ícono de Pikachu representa tus vidas: puedes fallar una vez, pero no recuperarás la vida perdida a menos que completes el tablero.
                            La puntuación se va acumulando, y el contador indica cuántos tableros has superado.

                            ¡Recuerda que puedes pulsar sobre las etiquetas del tablero para consultar información sobre posibles Pokémon que cumplan las condiciones!                        {'\n'}{'\n'}¡Buena suerte!
                        </Text>

                        <TouchableOpacity
                            onPress={() => setInfoVisible(false)}
                            style={{
                                backgroundColor: Colors.Botones_menu,
                                paddingVertical: 8,
                                paddingHorizontal: 20,
                                borderRadius: 10,
                                alignSelf: 'center'
                            }}
                        >
                            <Text style={{
                                fontFamily: 'Pixel',
                                fontSize: 14,
                                color: Colors.blanco
                            }}>
                                Entendido
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.Fondo,
        padding: 10,
        justifyContent: 'space-between',
    },
    header: {
        marginTop: 20,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    title: {
        color: Colors.blanco,
        fontSize: 40,
        fontFamily: 'Pixel',
    },
    infoIcon: {
        width: 35,
        height: 35,
    },
    scoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    scoreText: {
        color: Colors.blanco,
        fontSize: 26,
        fontFamily: 'Pixel',
    },
    scoreIcon: {
        width: 58,
        height: 58,
        marginLeft: 5,
    },
    gridContainer: {
        marginTop: 20,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    corner: {
        width: 80,
        height: 40,
        justifyContent: 'space-around'
    },
    typeLabel: {
        width: 95,
        textAlign: 'center',
        color: Colors.blanco,
        backgroundColor: Colors.Botones_menu,
        borderRadius: 5,
        fontSize: 18,
        fontFamily: 'Pixel',
    },
    typeLabel2: {
        flex: 1,
        width: 150,
        textAlign: 'center',
        color: Colors.blanco,
        backgroundColor: Colors.Botones_menu,
        borderRadius: 5,
        fontSize: 20,
        fontFamily: 'Pixel',
        padding: 10,
        margin: 15
    },
    cell: {
        width: 90,
        height: 90,
        margin: 5,
        backgroundColor: Colors.Botones_menu,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 15,
    },
    surrenderButton: {
        alignSelf: 'center',
        backgroundColor: Colors.Botones_menu,
        paddingHorizontal: 30,
        paddingVertical: 10,
        borderRadius: 20,
        marginBottom: 70,
    },
    surrenderText: {
        color: Colors.blanco,
        fontSize: 22,
        fontFamily: 'Pixel',
    },
    backButton: {
        position: 'absolute',
        bottom: 80,
        left: 20,
    },
    backIcon: {
        width: 40,
        height: 40,
    },
    labelCell: {
        width: 90,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
        marginLeft: -3
    },
    disabledCell: {
        opacity: 0.5,
    },
    timerText: {
        fontSize: 25,
        color: 'white',
        marginLeft: 60,
        fontFamily: 'Pixel',
        position: 'absolute',
        top: 12,
        right: 32,
    },
    pikachuContainer: {
        position: 'absolute',
        top: 20, 
        right: 20,
    },
    pikachu: {
        width: 70,
        height: 100,
        resizeMode: 'contain',
    },
    pikachuOscuro: {
        tintColor: 'black',
        opacity: 0.4,
    },
});
