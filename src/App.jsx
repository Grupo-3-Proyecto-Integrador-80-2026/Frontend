import './App.css'

function App() {
  // Puedes cambiar o agregar los nombres de tu equipo aquí
  const integrantes = [
    'Juan Pablo Escamilla Montilla - 202420580',
    'Santiago David Guerrero Jaramillo - 20241903',
    'Brayan Steven Candela Isaza - 20241501',
    'Nicolle Andrea Paz Molineros - 202419714',
  ]

  return (
    <div className="container">
      <header className="header">
        <span className="badge">Proyecto Integrador I</span>
        <h1>Organizador de Eventos Independientes</h1>
        <p className="subtitle">
          Mini-proyecto 1 &bull; Escuela de Ingeniería de Sistemas y Computación
        </p>
      </header>

      <main className="grid">
        {/* Tarjeta: Información General */}
        <section className="card">
          <h2>Información Académica</h2>
          <div className="info-item">
            <strong>Profesor:</strong>
            <span>Fabián S. Valencia C.</span>
          </div>
          <div className="info-item">
            <strong>Semestre:</strong>
            <span>2026-II</span>
          </div>
          <div className="info-item">
            <strong>Estado actual:</strong>
            <span className="status-badge">Sprint 0: Configuración inicial</span>
          </div>
        </section>

        {/* Tarjeta: Sobre el Proyecto */}
        <section className="card">
          <h2>Sobre el Proyecto</h2>
          <p>
            Herramienta diseñada para que organizadores independientes puedan
            planificar, registrar y reprogramar el trabajo logístico (salón,
            catering, proveedores) detectando sobrecargas diarias y visualizando
            el progreso de cada evento.
          </p>
        </section>

        {/* Tarjeta: Equipo */}
        <section className="card full-width">
          <h2>Integrantes del Grupo</h2>
          <ul className="team-list">
            {integrantes.map((nombre, index) => (
              <li key={index} className="team-member">
                <span>{nombre}</span>
              </li>
            ))}
          </ul>
        </section>
      </main>

      <footer className="footer">
        <p>Front-end inicializado con React + Vite &bull; Listo para integrar con API REST</p>
      </footer>
    </div>
  )
}

export default App