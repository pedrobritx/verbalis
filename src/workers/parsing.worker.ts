import { expose } from 'comlink'

const parsingWorker = {
  parse: (_content: string) => {
    return [] as string[]
  },
}

expose(parsingWorker)
