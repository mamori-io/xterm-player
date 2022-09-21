import { XtermPlayer } from '../src/Player'
const AUDIO_CAST = require('../assets/audio.cast')

type BuiltinTheme = 'THEME_SOLARIZED_DARK' | 'THEME_SOLARIZED_LIGHT'

function $id(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) { throw new Error('Cannot find element ' + id) }
  return el
}

function randomString() {
    return Math.random().toString(36).substring(2);
}

class RandomStream {
    start: number = Date.now();
    now: number = 0.0
    header: any =  {
        version: 2,
        width: 80,
        height: 25,
        duration: Infinity,
    }
    events: any[] = [
    ]

    public setFeeder(feeder: () => void) {
        this.events = []
        let msg = "Random data will follow soon...\r\n\r\n";
        let time = 0.0;
        for(let i=0; i<msg.length; i++) {
            this.events.push({
                time: time,
                type: 'o',
                data: msg.charAt(i)
            });

            time = time + 10;
        }

        let again = () => {
            this.events.push({
                time: Date.now() - this.start,
                type: 'o',
                data: randomString()
            });

            feeder();
            window.setTimeout(again, 100 + Math.random() * 1000);
        }

        window.setTimeout(again, 100 + Math.random() * 1000);
        console.info(this);
    }
}

const SAMPLE_CAST_URLS: { [key: string]: any } = {
  'sample cast with audio': AUDIO_CAST,
  'asciinema-1': 'https://raw.githubusercontent.com/JavaCS3/xterm-player/master/assets/1.cast',
  'asciinema-2': 'https://raw.githubusercontent.com/JavaCS3/xterm-player/master/assets/5.cast',
  'asciinema-3': 'https://raw.githubusercontent.com/JavaCS3/xterm-player/master/assets/4.cast',
  'terminalizer': 'https://raw.githubusercontent.com/faressoft/terminalizer-player/master/data.json',
  'random': new RandomStream()
}

const app = $id('app')
const castOption = <HTMLSelectElement>$id('cast-option')
const themeOption = <HTMLSelectElement>$id('theme-option')

const player = new XtermPlayer(AUDIO_CAST, app)

castOption.onchange = () => {
  player.url = SAMPLE_CAST_URLS[castOption.value] || AUDIO_CAST
}
themeOption.onchange = () => {
  player.options = { theme: XtermPlayer[<BuiltinTheme>themeOption.value] }
}
