export interface ICastHeader {
  version: number
  width: number
  height: number
  duration: number
  audio?: string
}

export interface ICastEvent {
  time: number
  type: string
  data: string
}

export interface ICastObject {
  header: ICastHeader
  events: ICastEvent[]
}

export interface IStreamCastObject extends ICastObject {
    setFeeder(feeder: () => void): void
}
