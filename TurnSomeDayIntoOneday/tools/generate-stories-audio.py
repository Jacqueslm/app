"""Narrate the audio stories (data/audio-stories.json) with the app's Piper voices.

    python3 tools/generate-stories-audio.py <piper-voices-folder> <output-folder>

One mp3 per story under <output>/stories/, named <id>.mp3. Existing files are
skipped, so re-running is cheap and the run resumes after any interruption.
Voice per story fits the narrator (only one male model exists, so all male
narrators share it; female narrators rotate the four female voices).
"""
import sys,os,json,re,subprocess,wave
import numpy as np, sherpa_onnx

VOICES={
 'warm':'vits-piper-en_US-kristin-medium/en_US-kristin-medium.onnx',
 'soft':'vits-piper-en_GB-cori-medium/en_GB-cori-medium.onnx',
 'gentle':'vits-piper-en_US-kathleen-low/en_US-kathleen-low.onnx',
 'clear':'vits-piper-en_US-ljspeech-high/en_US-ljspeech-high.onnx',
 'male':'vits-piper-en_US-john-medium/en_US-john-medium.onnx',
}
ASSIGN={'alcohol-user-marcus':'male','pornography-user-daniel':'male',
 'methamphetamine-user-rachel':'warm','gambling-user-tony':'male',
 'food-user-carla':'soft','alcohol-supporter-jenny':'gentle',
 'pills-supporter-david':'male','gambling-supporter-linda':'clear',
 'pornography-supporter-maya':'warm','alcohol-supporter-grace':'soft'}
FF='/usr/local/lib/python3.11/dist-packages/imageio_ffmpeg/binaries/ffmpeg-linux-x86_64-v7.0.2'

def speakable(t):
    t=t.replace('&',' and ').replace('/',', ')
    return re.sub(r'\s+',' ',t).strip()

def main():
    vdir,out=sys.argv[1],sys.argv[2]
    os.makedirs(os.path.join(out,'stories'),exist_ok=True)
    data=json.load(open(os.path.join(os.path.dirname(__file__),'..','data','audio-stories.json')))
    tts_cache={}
    for st in data['stories']:
        dest=os.path.join(out,'stories',st['id']+'.mp3')
        if os.path.exists(dest):print('skip',st['id']);continue
        vk=ASSIGN.get(st['id'],'warm')
        if vk not in tts_cache:
            m=os.path.join(vdir,VOICES[vk])
            cfg=sherpa_onnx.OfflineTtsConfig(model=sherpa_onnx.OfflineTtsModelConfig(
                vits=sherpa_onnx.OfflineTtsVitsModelConfig(model=m,tokens=os.path.join(os.path.dirname(m),'tokens.txt'),
                    data_dir=os.path.join(os.path.dirname(m),'espeak-ng-data')),num_threads=2))
            tts_cache[vk]=sherpa_onnx.OfflineTts(cfg)
        tts=tts_cache[vk]
        paras=[p for p in st['text'].split('\n\n') if p.strip()]
        chunks=[]
        for p in paras:
            audio=tts.generate(speakable(p),sid=0,speed=0.92)
            chunks.append(np.asarray(audio.samples,dtype=np.float32))
            chunks.append(np.zeros(int(audio.sample_rate*0.65),dtype=np.float32))  # paragraph breath
        sr=audio.sample_rate
        pcm=np.concatenate(chunks)
        tmp=dest+'.wav'
        with wave.open(tmp,'w') as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(sr)
            w.writeframes((np.clip(pcm,-1,1)*32767).astype(np.int16).tobytes())
        subprocess.run([FF,'-y','-v','error','-i',tmp,'-ar','44100','-b:a','48k',dest],check=True)
        os.remove(tmp)
        print(st['id'],'->',round(len(pcm)/sr/60,1),'min',vk)
if __name__=='__main__':main()
