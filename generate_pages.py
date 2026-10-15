import os

template_mision = """<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Misión y Visión | PGET</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <header class="navbar" style="background: var(--glass-bg);">
        <div class="nav-container">
            <div class="logo-container">
                <img src="assets/logo.png" alt="Logo PGET" class="logo" onerror="this.src='https://via.placeholder.com/60?text=PGET'">
                <div class="logo-text">
                    <h1>PROCURADURÍA GENERAL</h1>
                    <h2>DEL ESTADO TRUJILLO</h2>
                </div>
            </div>
            <nav class="nav-links">
                <a href="index.html">Inicio</a>
                <a href="quienes-somos.html">¿Quiénes Somos?</a>
                <div class="dropdown">
                    <a href="#" class="dropbtn">Filosofía Institucional <i class="fas fa-chevron-down"></i></a>
                    <div class="dropdown-content">
                        <a href="mision-vision.html">Misión y Visión</a>
                        <a href="valores.html">Valores y Principios</a>
                    </div>
                </div>
                <div class="dropdown">
                    <a href="#" class="dropbtn">Organización <i class="fas fa-chevron-down"></i></a>
                    <div class="dropdown-content">
                        <a href="organigrama.html">Organigrama</a>
                        <a href="direcciones.html">Direcciones</a>
                    </div>
                </div>
                <a href="bases-juridicas.html">Bases Jurídicas</a>
                <a href="contacto.html">Contacto</a>
            </nav>
            <div class="nav-actions">
                <button id="loginBtn" class="btn-primary"><i class="fas fa-user"></i> Iniciar Sesión</button>
            </div>
        </div>
    </header>

    <div style="padding-top: 100px; background: var(--primary-color); color: white; text-align: center; padding-bottom: 40px;">
        <h1 style="font-size: 2.5rem; margin-top: 40px; text-transform: uppercase;">Misión y Visión</h1>
    </div>

    <section class="info-section">
        <div class="container" style="max-width: 900px; background: white; padding: 40px; border-radius: 20px; box-shadow: var(--shadow-soft);">
            <h2 class="section-title left">Misión</h2>
            <p style="font-size: 1.15rem; color: #475569; line-height: 1.8; text-align: justify; margin-top: 30px;">
                Ser el órgano rector en la defensa y representación judicial y extrajudicial del Estado Trujillo en todo lo relacionado a sus intereses patrimoniales, espirituales, históricos, culturales, multiétnicos, jurídicos, democráticos, geográficos y ambientales; igualmente, prestar asesoría jurídica de forma idónea, eficaz y responsable al Poder Público Estadal en coordinación con otros órganos y entes adscritos a la Gobernación del Estado y demás órganos que conforman el Poder Público en sus diferentes niveles políticos–territoriales, de la misma forma a las comunidades organizadas y/o personas naturales, con capacidad para dar respuesta en corto y mediano plazo a las solicitudes y asuntos de índole general, particular e institucional que a diario ingresan a la institución, con el objeto de fortalecer una entidad igualitaria y justa.
            </p>

            <h2 class="section-title left" style="margin-top: 50px;">Visión</h2>
            <p style="font-size: 1.15rem; color: #475569; line-height: 1.8; text-align: justify; margin-top: 30px;">
                Consolidarse como el órgano de representación, asesoría y defensa del Estado Trujillo, de tal manera que su labor sea el reflejo de la excelencia organizacional, demostrando que sus actuaciones se desarrollan bajo criterios de legalidad, transparencia, eficiencia y eficacia, y de esta manera ser referencia para otros órganos cuyas funciones giren en torno al ámbito jurídico.
            </p>
        </div>
    </section>

    <footer>
        <div class="container footer-content">
            <div class="footer-logo">
                <h3>P.G.E.T.</h3>
                <p>Procuraduría General del Estado Trujillo</p>
            </div>
            <div class="footer-contact">
                <p><i class="fas fa-id-card"></i> <strong>RIF:</strong> G-20000417-7</p>
                <p><i class="fas fa-map-marker-alt"></i> Palacio de Gobierno, 2do Piso, Av. Independencia</p>
                <p><i class="fas fa-envelope"></i> procuraduriageneraltrujillo@gmail.com</p>
                <p><i class="fas fa-phone"></i> 0272-2365126</p>
                <p><i class="fab fa-instagram"></i> @procuraduria_trujillo</p>
            </div>
        </div>
        <div class="footer-bottom">
            <p>&copy; 2026 Procuraduría General del Estado Trujillo &bull; RIF: G-20000417-7 &bull; Todos los derechos reservados.</p>
        </div>
    </footer>
    <script src="js/script.js"></script>
</body>
</html>"""

template_valores = """<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Valores y Principios | PGET</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <header class="navbar" style="background: var(--glass-bg);">
        <div class="nav-container">
            <div class="logo-container">
                <img src="assets/logo.png" alt="Logo PGET" class="logo" onerror="this.src='https://via.placeholder.com/60?text=PGET'">
                <div class="logo-text">
                    <h1>PROCURADURÍA GENERAL</h1>
                    <h2>DEL ESTADO TRUJILLO</h2>
                </div>
            </div>
            <nav class="nav-links">
                <a href="index.html">Inicio</a>
                <a href="quienes-somos.html">¿Quiénes Somos?</a>
                <div class="dropdown">
                    <a href="#" class="dropbtn">Filosofía Institucional <i class="fas fa-chevron-down"></i></a>
                    <div class="dropdown-content">
                        <a href="mision-vision.html">Misión y Visión</a>
                        <a href="valores.html">Valores y Principios</a>
                    </div>
                </div>
                <div class="dropdown">
                    <a href="#" class="dropbtn">Organización <i class="fas fa-chevron-down"></i></a>
                    <div class="dropdown-content">
                        <a href="organigrama.html">Organigrama</a>
                        <a href="direcciones.html">Direcciones</a>
                    </div>
                </div>
                <a href="bases-juridicas.html">Bases Jurídicas</a>
                <a href="contacto.html">Contacto</a>
            </nav>
            <div class="nav-actions">
                <button id="loginBtn" class="btn-primary"><i class="fas fa-user"></i> Iniciar Sesión</button>
            </div>
        </div>
    </header>

    <div style="padding-top: 100px; background: var(--primary-color); color: white; text-align: center; padding-bottom: 40px;">
        <h1 style="font-size: 2.5rem; margin-top: 40px; text-transform: uppercase;">Valores y Principios</h1>
    </div>

    <section class="info-section">
        <div class="container" style="max-width: 900px; background: white; padding: 40px; border-radius: 20px; box-shadow: var(--shadow-soft);">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 40px;">
                <div>
                    <h2 class="section-title left">Valores</h2>
                    <ul style="font-size: 1.15rem; color: #475569; line-height: 2; margin-top: 30px; padding-left: 20px;">
                        <li>Respeto</li>
                        <li>Justicia</li>
                        <li>Lealtad</li>
                        <li>Tolerancia</li>
                        <li>Responsabilidad Social y Ambiental</li>
                        <li>Conciencia del Deber Social</li>
                        <li>Compromiso Organizacional</li>
                        <li>Visión de Futuro</li>
                    </ul>
                </div>
                <div>
                    <h2 class="section-title left">Principios</h2>
                    <ul style="font-size: 1.15rem; color: #475569; line-height: 2; margin-top: 30px; padding-left: 20px;">
                        <li>Legalidad, Celeridad, Eficiencia</li>
                        <li>Eficacia, Transparencia</li>
                        <li>Rendición de cuentas, Economía</li>
                        <li>Simplicidad, Buena fe</li>
                        <li>Imparcialidad, Idoneidad</li>
                        <li>Participación, Responsabilidad</li>
                        <li>Honestidad</li>
                        <li>Responsabilidad en la función pública</li>
                        <li>Sometimiento pleno a la ley y al derecho</li>
                    </ul>
                </div>
            </div>
        </div>
    </section>

    <footer>
        <div class="container footer-content">
            <div class="footer-logo">
                <h3>P.G.E.T.</h3>
                <p>Procuraduría General del Estado Trujillo</p>
            </div>
            <div class="footer-contact">
                <p><i class="fas fa-id-card"></i> <strong>RIF:</strong> G-20000417-7</p>
                <p><i class="fas fa-map-marker-alt"></i> Palacio de Gobierno, 2do Piso, Av. Independencia</p>
                <p><i class="fas fa-envelope"></i> procuraduriageneraltrujillo@gmail.com</p>
                <p><i class="fas fa-phone"></i> 0272-2365126</p>
                <p><i class="fab fa-instagram"></i> @procuraduria_trujillo</p>
            </div>
        </div>
        <div class="footer-bottom">
            <p>&copy; 2026 Procuraduría General del Estado Trujillo &bull; RIF: G-20000417-7 &bull; Todos los derechos reservados.</p>
        </div>
    </footer>
    <script src="js/script.js"></script>
</body>
</html>"""

template_quienes = """<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>¿Quiénes Somos? | PGET</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <header class="navbar" style="background: var(--glass-bg);">
        <div class="nav-container">
            <div class="logo-container">
                <img src="assets/logo.png" alt="Logo PGET" class="logo" onerror="this.src='https://via.placeholder.com/60?text=PGET'">
                <div class="logo-text">
                    <h1>PROCURADURÍA GENERAL</h1>
                    <h2>DEL ESTADO TRUJILLO</h2>
                </div>
            </div>
            <nav class="nav-links">
                <a href="index.html">Inicio</a>
                <a href="quienes-somos.html">¿Quiénes Somos?</a>
                <div class="dropdown">
                    <a href="#" class="dropbtn">Filosofía Institucional <i class="fas fa-chevron-down"></i></a>
                    <div class="dropdown-content">
                        <a href="mision-vision.html">Misión y Visión</a>
                        <a href="valores.html">Valores y Principios</a>
                    </div>
                </div>
                <div class="dropdown">
                    <a href="#" class="dropbtn">Organización <i class="fas fa-chevron-down"></i></a>
                    <div class="dropdown-content">
                        <a href="organigrama.html">Organigrama</a>
                        <a href="direcciones.html">Direcciones</a>
                    </div>
                </div>
                <a href="bases-juridicas.html">Bases Jurídicas</a>
                <a href="contacto.html">Contacto</a>
            </nav>
            <div class="nav-actions">
                <button id="loginBtn" class="btn-primary"><i class="fas fa-user"></i> Iniciar Sesión</button>
            </div>
        </div>
    </header>

    <div style="padding-top: 100px; background: var(--primary-color); color: white; text-align: center; padding-bottom: 40px;">
        <h1 style="font-size: 2.5rem; margin-top: 40px;">¿QUIÉNES SOMOS?</h1>
    </div>

    <section class="info-section">
        <div class="container" style="max-width: 900px; background: white; padding: 40px; border-radius: 20px; box-shadow: var(--shadow-soft);">
            <p style="font-size: 1.15rem; color: #475569; line-height: 1.8; text-align: justify; margin-bottom: 40px;">
                La Procuraduría General del Estado Trujillo es el Órgano Superior de Consulta, Asistencia, Representación y Defensa de la Administración Pública Estadal.
            </p>

            <h2 class="section-title left">Nuestros Objetivos</h2>
            <ol style="font-size: 1.15rem; color: #475569; line-height: 1.8; text-align: justify; margin-top: 30px; padding-left: 20px;">
                <li style="margin-bottom: 15px;">Representar y defender, judicial y extrajudicialmente, los intereses del Estado en todo lo relacionado con sus bienes y demás derechos.</li>
                <li style="margin-bottom: 15px;">Representar y defender al Estado en los procedimientos que le corresponda actuar como parte demandante o demandada, así como en los de Jurisdicción Graciosa.</li>
                <li style="margin-bottom: 15px;">Prestar asesoría jurídica, emitir dictámenes y opiniones jurídicas por mandato de la Ley o cuando así lo requieran los órganos del Poder Público Estadal.</li>
                <li style="margin-bottom: 15px;">Emitir opinión jurídica previa sobre los proyectos y anteproyectos de ley que le sean sometidos para su estudio.</li>
                <li style="margin-bottom: 15px;">Representar al Ejecutivo del Estado en la elaboración y discusión de las Convenciones Colectivas de Trabajo a que sea emplazado a celebrar y discutir con sus trabajadores; en los conflictos que pudieran suscitarse con ocasión de la ejecución de aquellas; y participar, a los fines antes señalados, en las discusiones que lleven adelante los entes descentralizados del Estado.</li>
                <li style="margin-bottom: 15px;">Conocer de toda reclamación intentada contra el Ejecutivo del Estado que tengan como pretensión el pago de acreencias.</li>
                <li style="margin-bottom: 15px;">Llevar el control, registro, fiscalización y mantenimiento del archivo de los bienes muebles e inmuebles propiedad del Estado.</li>
                <li style="margin-bottom: 15px;">Cualquier otra que establezca la Constitución de la República Bolivariana de Venezuela, la Constitución del Estado Trujillo y demás leyes de la República.</li>
            </ol>
        </div>
    </section>

    <footer>
        <div class="container footer-content">
            <div class="footer-logo">
                <h3>P.G.E.T.</h3>
                <p>Procuraduría General del Estado Trujillo</p>
            </div>
            <div class="footer-contact">
                <p><i class="fas fa-id-card"></i> <strong>RIF:</strong> G-20000417-7</p>
                <p><i class="fas fa-map-marker-alt"></i> Palacio de Gobierno, 2do Piso, Av. Independencia</p>
                <p><i class="fas fa-envelope"></i> procuraduriageneraltrujillo@gmail.com</p>
                <p><i class="fas fa-phone"></i> 0272-2365126</p>
                <p><i class="fab fa-instagram"></i> @procuraduria_trujillo</p>
            </div>
        </div>
        <div class="footer-bottom">
            <p>&copy; 2026 Procuraduría General del Estado Trujillo &bull; RIF: G-20000417-7 &bull; Todos los derechos reservados.</p>
        </div>
    </footer>
    <script src="js/script.js"></script>
</body>
</html>"""

template_contacto = """<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Contacto | PGET</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <header class="navbar" style="background: var(--glass-bg);">
        <div class="nav-container">
            <div class="logo-container">
                <img src="assets/logo.png" alt="Logo PGET" class="logo" onerror="this.src='https://via.placeholder.com/60?text=PGET'">
                <div class="logo-text">
                    <h1>PROCURADURÍA GENERAL</h1>
                    <h2>DEL ESTADO TRUJILLO</h2>
                </div>
            </div>
            <nav class="nav-links">
                <a href="index.html">Inicio</a>
                <a href="quienes-somos.html">¿Quiénes Somos?</a>
                <div class="dropdown">
                    <a href="#" class="dropbtn">Filosofía Institucional <i class="fas fa-chevron-down"></i></a>
                    <div class="dropdown-content">
                        <a href="mision-vision.html">Misión y Visión</a>
                        <a href="valores.html">Valores y Principios</a>
                    </div>
                </div>
                <div class="dropdown">
                    <a href="#" class="dropbtn">Organización <i class="fas fa-chevron-down"></i></a>
                    <div class="dropdown-content">
                        <a href="organigrama.html">Organigrama</a>
                        <a href="direcciones.html">Direcciones</a>
                    </div>
                </div>
                <a href="bases-juridicas.html">Bases Jurídicas</a>
                <a href="contacto.html">Contacto</a>
            </nav>
            <div class="nav-actions">
                <button id="loginBtn" class="btn-primary"><i class="fas fa-user"></i> Iniciar Sesión</button>
            </div>
        </div>
    </header>

    <div style="padding-top: 100px; background: var(--primary-color); color: white; text-align: center; padding-bottom: 40px;">
        <h1 style="font-size: 2.5rem; margin-top: 40px; text-transform: uppercase;">Ubicación y Contacto</h1>
    </div>

    <section class="info-section">
        <div class="container" style="max-width: 900px; background: white; padding: 40px; border-radius: 20px; box-shadow: var(--shadow-soft);">
            <h2 class="section-title center">Contáctanos</h2>
            <div style="font-size: 1.15rem; color: #475569; line-height: 2.5; margin-top: 30px; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto;">
                <p><i class="fas fa-map-marker-alt" style="color: var(--primary-color); font-size: 1.5rem; margin-right: 15px; width: 30px; text-align: center;"></i> <strong>Dirección:</strong> Palacio de Gobierno, 2do Piso, Av. Independencia, frente a la Plaza Bolívar</p>
                <p><i class="fas fa-envelope" style="color: var(--primary-color); font-size: 1.5rem; margin-right: 15px; width: 30px; text-align: center;"></i> <strong>Correo:</strong> procuraduriageneraltrujillo@gmail.com</p>
                <p><i class="fas fa-phone" style="color: var(--primary-color); font-size: 1.5rem; margin-right: 15px; width: 30px; text-align: center;"></i> <strong>Teléfono:</strong> 0272-2365126</p>
                <p><i class="fab fa-instagram" style="color: var(--primary-color); font-size: 1.5rem; margin-right: 15px; width: 30px; text-align: center;"></i> <strong>Instagram:</strong> @procuraduria_trujillo</p>
            </div>
        </div>
    </section>

    <footer>
        <div class="container footer-content">
            <div class="footer-logo">
                <h3>P.G.E.T.</h3>
                <p>Procuraduría General del Estado Trujillo</p>
            </div>
            <div class="footer-contact">
                <p><i class="fas fa-id-card"></i> <strong>RIF:</strong> G-20000417-7</p>
                <p><i class="fas fa-map-marker-alt"></i> Palacio de Gobierno, 2do Piso, Av. Independencia</p>
                <p><i class="fas fa-envelope"></i> procuraduriageneraltrujillo@gmail.com</p>
                <p><i class="fas fa-phone"></i> 0272-2365126</p>
                <p><i class="fab fa-instagram"></i> @procuraduria_trujillo</p>
            </div>
        </div>
        <div class="footer-bottom">
            <p>&copy; 2026 Procuraduría General del Estado Trujillo &bull; RIF: G-20000417-7 &bull; Todos los derechos reservados.</p>
        </div>
    </footer>
    <script src="js/script.js"></script>
</body>
</html>"""

template_organigrama = """<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Organigrama | PGET</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link rel="stylesheet" href="css/styles.css">
</head>
<body>
    <header class="navbar" style="background: var(--glass-bg);">
        <div class="nav-container">
            <div class="logo-container">
                <img src="assets/logo.png" alt="Logo PGET" class="logo" onerror="this.src='https://via.placeholder.com/60?text=PGET'">
                <div class="logo-text">
                    <h1>PROCURADURÍA GENERAL</h1>
                    <h2>DEL ESTADO TRUJILLO</h2>
                </div>
            </div>
            <nav class="nav-links">
                <a href="index.html">Inicio</a>
                <a href="quienes-somos.html">¿Quiénes Somos?</a>
                <div class="dropdown">
                    <a href="#" class="dropbtn">Filosofía Institucional <i class="fas fa-chevron-down"></i></a>
                    <div class="dropdown-content">
                        <a href="mision-vision.html">Misión y Visión</a>
                        <a href="valores.html">Valores y Principios</a>
                    </div>
                </div>
                <div class="dropdown">
                    <a href="#" class="dropbtn">Organización <i class="fas fa-chevron-down"></i></a>
                    <div class="dropdown-content">
                        <a href="organigrama.html">Organigrama</a>
                        <a href="direcciones.html">Direcciones</a>
                    </div>
                </div>
                <a href="bases-juridicas.html">Bases Jurídicas</a>
                <a href="contacto.html">Contacto</a>
            </nav>
            <div class="nav-actions">
                <button id="loginBtn" class="btn-primary"><i class="fas fa-user"></i> Iniciar Sesión</button>
            </div>
        </div>
    </header>

    <div style="padding-top: 100px; background: var(--primary-color); color: white; text-align: center; padding-bottom: 40px;">
        <h1 style="font-size: 2.5rem; margin-top: 40px; text-transform: uppercase;">Organigrama</h1>
    </div>

    <section class="info-section">
        <div class="container" style="max-width: 1100px; background: white; padding: 40px; border-radius: 20px; box-shadow: var(--shadow-soft);">
            <h2 class="section-title">Estructura Organizativa</h2>
            
            <div class="tree">
                <ul>
                    <li>
                        <a href="#">DESPACHO DEL PROCURADOR<br>O PROCURADORA GENERAL</a>
                        <ul>
                            <li>
                                <a href="#">DIRECCIÓN GENERAL</a>
                                <ul>
                                    <li><a href="#">DIRECCIÓN DE<br>ADMINISTRACIÓN</a></li>
                                    <li><a href="#">DIRECCIÓN DE<br>ASUNTOS JURÍDICOS</a></li>
                                    <li>
                                        <a href="#">DIRECCIÓN DE<br>BIENES Y SERVICIOS</a>
                                        <ul>
                                            <li><a href="#">CATASTRO</a></li>
                                            <li><a href="#">COMPUTACIÓN Y<br>SISTEMA</a></li>
                                            <li><a href="#">ARCHIVO</a></li>
                                            <li><a href="#">EXPROPIACIONES Y<br>AVALÚO</a></li>
                                        </ul>
                                    </li>
                                    <li><a href="#">DIRECCIÓN DE<br>RECURSOS HUMANOS</a></li>
                                </ul>
                            </li>
                        </ul>
                    </li>
                </ul>
            </div>

        </div>
    </section>

    <footer>
        <div class="container footer-content">
            <div class="footer-logo">
                <h3>P.G.E.T.</h3>
                <p>Procuraduría General del Estado Trujillo</p>
            </div>
            <div class="footer-contact">
                <p><i class="fas fa-map-marker-alt"></i> Palacio de Gobierno, 2do Piso, Av. Independencia</p>
                <p><i class="fas fa-envelope"></i> procuraduriageneraltrujillo@gmail.com</p>
                <p><i class="fas fa-phone"></i> 0272-2365126</p>
                <p><i class="fab fa-instagram"></i> @procuraduria_trujillo</p>
            </div>
        </div>
        <div class="footer-bottom">
            <p>&copy; 2026 Procuraduría General del Estado Trujillo. Todos los derechos reservados.</p>
        </div>
    </footer>
    <script src="js/script.js"></script>
</body>
</html>"""

import os
with open('d:/pagina web/frontend/mision-vision.html', 'w', encoding='utf-8') as f:
    f.write(template_mision)

with open('d:/pagina web/frontend/valores.html', 'w', encoding='utf-8') as f:
    f.write(template_valores)

with open('d:/pagina web/frontend/quienes-somos.html', 'w', encoding='utf-8') as f:
    f.write(template_quienes)

with open('d:/pagina web/frontend/contacto.html', 'w', encoding='utf-8') as f:
    f.write(template_contacto)

# organigrama.html is maintained directly with the modern vector interactive diagram
# with open('d:/pagina web/frontend/organigrama.html', 'w', encoding='utf-8') as f:
#     f.write(template_organigrama)
