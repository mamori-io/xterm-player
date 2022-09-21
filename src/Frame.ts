import { ICastEvent, ICastObject, IStreamCastObject } from './Cast'
import { Slice } from './Utils'
import { IDisposable } from './Types'
import { EventEmitter, IEvent } from './Events'

export interface IFrame {
  readonly startTime: number
  readonly endTime: number
  prev: IFrame | null
  duration(): number
  data(endTime: number, startTime?: number): string
  snapshot(): string
}

class NullFrame implements IFrame {
  public prev: IFrame | null = null
  constructor(
    public readonly startTime: number = 0,
    public readonly endTime: number = 0
  ) { }
  duration(): number { return this.endTime - this.startTime }
  data(endTime: number, startTime?: number): string { return '' }
  snapshot(): string {
    if (this.prev) {
      return this.prev.snapshot()
    }
    return ''
  }
}

export type FrameSnapshotFn = (s: string) => string
export const DEFAULT_FRAME_SNAPSHOT_FN = (s: string) => s
export const NULL_FRAME: IFrame = Object.freeze<NullFrame>(new NullFrame())
export const START_FRAME: IFrame = NULL_FRAME

export class CastEventsFrame implements IFrame {
  private _prev: IFrame | null = null
  private _snapshotCache: string | null = null

  constructor(
    public readonly startTime: number,
    public readonly endTime: number,
    private _events: Slice<ICastEvent>,
    private _snapshotFn: FrameSnapshotFn = DEFAULT_FRAME_SNAPSHOT_FN
  ) {
    if (!_events.len()) { throw new Error('Invalid frame: empty events') }
    if ((startTime < 0) || ((endTime - startTime) < 0)) {
      throw new Error('Invalid frame: inccorrect time or size')
    }
    if (_events.get(0).time > endTime) { throw new Error('Invalid frame: invalid events') }
  }
  public set prev(f: IFrame | null) {
    if (f !== this._prev) {
      this._prev = f
      this._snapshotCache = null
    }
  }
  public get prev(): IFrame | null {
    return this._prev
  }
  public duration(): number {
    return this.endTime - this.startTime
  }
  data(endTime: number, startTime: number = -1): string {
    if ((endTime < this.startTime) || (endTime >= this.endTime)) {
      throw new Error(`Cannot get data of time(${endTime})`)
    }
    const tmp: string[] = []
    for (let i = 0; i < this._events.len(); i++) {
      const ev = this._events.get(i)
      if (ev.time > endTime) { break }
      if (startTime < ev.time && ev.time <= endTime) {
        tmp.push(ev.data)
      }
    }
    return tmp.join('')
  }
  snapshot(): string {
    if (this._snapshotCache !== null) {
      return this._snapshotCache
    }
    const tmp: string[] = new Array<string>(this._events.len())
    for (let i = 0; i < this._events.len(); i++) {
      tmp[i] = this._events.get(i).data
    }
    const ret = (this.prev ? this._snapshotFn(this.prev.snapshot() + tmp.join('')) : tmp.join(''))
    return this._snapshotCache = ret
  }
}

const DEFAULT_FRAME_EVENTS_STEP = 30


export interface IFrameQueue extends IDisposable {
  isEnd(frame: IFrame): boolean
  len(): number
  frame(time: number): IFrame
  readonly onDurationChanged: IEvent<number>
}

export class NullFrameQueue implements IFrameQueue {
  private _onDurationChanged = new EventEmitter<number>()

  isEnd(frame: IFrame): boolean { return true }
  len(): number { return 0 }
  frame(time: number): IFrame { return NULL_FRAME }
  dispose(): void { }
  public get onDurationChanged(): IEvent<number> { return this._onDurationChanged.onEvent }
}

export class CastFrameQueue implements IFrameQueue {
  private _endFrame: IFrame = new NullFrame(0, 0);
  private _frames: Array<IFrame> = []
  private _onDurationChanged = new EventEmitter<number>()
  private _start: number = 0;
  private _n: number = 1;
  private _duration: number = 0;

  constructor(
    cast: ICastObject,
    step: number = DEFAULT_FRAME_EVENTS_STEP,
    snapshotFn: FrameSnapshotFn = DEFAULT_FRAME_SNAPSHOT_FN
  ) {
      this.addFrames(cast, step, snapshotFn);

      if((cast as IStreamCastObject).setFeeder) {
          (cast as IStreamCastObject).setFeeder(() => {
              let oldDuration = this._duration;
              this.addFrames(cast, step, snapshotFn);

              if(oldDuration !== this._duration) {
                  this._onDurationChanged.fire(this._duration);
              }
          });
      }
  }

  addFrames(
    cast: ICastObject,
    step: number,
    snapshotFn: FrameSnapshotFn
  ) {
    const duration = cast.header.duration
    const events = cast.events

    if(this._frames.length === 0) {
      this._frames = new Array<IFrame>(2 + Math.ceil(events.length / step))
      this._frames[0] = START_FRAME
      this._frames[this._frames.length - 1] = this._endFrame = new NullFrame(duration, duration)
    }

    let prev = this._frames[this._start];
    while (this._start < events.length) {
      let end = this._start + step
      const slice = new Slice<ICastEvent>(cast.events, this._start, end) // TODO: Do a benchmark of [].slice vs Slice
      end = this._start + slice.len() - 1;
      const startTime = slice.get(0).time
      const endTime = events[end].time
      const f = new CastEventsFrame(startTime, endTime, slice, snapshotFn)
      f.prev = prev
      this._frames[this._n++] = prev = f
      this._start += step
    }

    this._start = events.length;
    this._endFrame = this._frames[this._frames.length - 1];
    this._endFrame.prev = this._frames[this._frames.length - 2]
    this._duration = this._endFrame.endTime;
  }

  public get onDurationChanged(): IEvent<number> { return this._onDurationChanged.onEvent }

  public isEnd(frame: IFrame): boolean { return frame === this._endFrame }
  public len(): number { return this._frames.length - 2 }
  public frame(time: number): IFrame {
    if (time < 0) { throw new Error('Time must not be negative') }
    if (!this.len()) { throw new Error('Empty frames') }
    // bisearch
    const frames = this._frames
    let min = 1, mid = 0, max = this.len()
    if (time >= this._frames[max].endTime) { return this._endFrame }
    while (max >= min) {
      mid = (min + max) >> 1
      const f = frames[mid]
      if (time >= f.endTime) {
        min = mid + 1
      } else if (time < f.startTime) {
        max = mid - 1
      } else {
        return f
      }
    }
    return NULL_FRAME
  }
  public dispose(): void { this._frames = [] }
}
