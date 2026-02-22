import {StartClient} from '@tanstack/react-start/client'
import {startTransition, StrictMode} from 'react'
import {hydrateRoot} from 'react-dom/client'

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  )
})
