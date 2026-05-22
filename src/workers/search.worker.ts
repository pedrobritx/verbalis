import { expose } from 'comlink'

const searchWorker = {
  search: (_query: string) => {
    return [] as unknown[]
  },
}

expose(searchWorker)
