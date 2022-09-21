import { ICastObject } from './Cast'
import { parse } from './CastParser'

async function innerFetchCast(url: string | ICastObject): Promise<ICastObject> {
    if(typeof url === "string") {
        const res = await fetch(url)

        return parse(await res.text())
    }

    return url;
}

export default function fetchCast(url: string | ICastObject): Promise<ICastObject> {
  return innerFetchCast(url)
}
