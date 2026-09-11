import { useState } from 'react'

function App() {
    const [message, setMessage] = useState(
        'The React frontend is running in the browser.'
    )

    return (
        <>
            <header>
                <h1>My Web App V2</h1>
            </header>

            <main>
                <section className="container">
                    <h2>React Foundation</h2>

                    <p>{message}</p>

                    <button
                        type="button"
                        onClick={() =>
                            setMessage('React state successfully updated the page.')
                        }
                    >
                        Test React
                    </button>
                </section>
            </main>

            <footer>
                <p>&copy; 2026 My Web App V2</p>
            </footer>
        </>
    )
}

export default App