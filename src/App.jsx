import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [mensajeBackend, setMensajeBackend] = useState('Conectando con la API...')
  const [errorBackend, setErrorBackend] = useState(false)

  const integrantes = [
    'Juan Pablo Escamilla Montilla - 202420580',
    'Santiago David Guerrero Jaramillo - 20241903',
    'Brayan Steven Candela Isaza - 20241501',
    'Nicolle Andrea Paz Molineros - 202419714',
  ]

  useEffect(() => {
    // Si no está definida la variable en el .env, usa Render por defecto
    const baseUrl = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000'

    fetch(`${baseUrl}/api/db-test/`)
      .then((res) => {
        if (!res.ok) throw new Error('Error en la respuesta del servidor')
        return res.json()
      })
      .then((data) => {
        setMensajeBackend(data.message)
        setErrorBackend(false)
      })
      .catch((err) => {
        console.error(err)
        setMensajeBackend('Error al conectar con la API / Base de datos')
        setErrorBackend(true)
      })
  }, [])

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
        {/* Tarjeta: Información Académica */}
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

        {/* Tarjeta: Prueba de Conexión Backend */}
        <section className="card">
          <h2>Estado Backend & BD</h2>
          <p style={{ color: errorBackend ? '#e63946' : '#2a9d8f', fontWeight: 'bold' }}>
            {mensajeBackend}
          </p>
          <small style={{ color: '#888' }}>
            Endpoint: /api/db-test/
          </small>
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
        <p>Front-end inicializado con React + Vite &bull; Integrado con Django REST Framework</p>
      </footer>
    </div>
  )
}

export default App