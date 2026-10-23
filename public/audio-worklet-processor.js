// 运行在 AudioWorklet 线程的 PCM 采集处理器，避免阻塞渲染线程
class LexiTypePcmProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._chunkCounter = 0;
  }

  process(inputs) {
    if (!inputs || inputs.length === 0) return true;
    const channelData = inputs[0]?.[0];
    if (!channelData) return true;

    const copy = new Float32Array(channelData);
    // 将数据回传给主线程，同时转移 buffer 减少拷贝
    this.port.postMessage({ type: 'pcm-data', buffer: copy.buffer }, [copy.buffer]);

    if (this._chunkCounter++ % 25 === 0) {
      let peak = 0;
      for (let i = 0; i < channelData.length; i++) {
        const val = Math.abs(channelData[i]);
        if (val > peak) peak = val;
      }
      if (peak < 0.01) {
        this.port.postMessage({ type: 'low-volume', value: peak });
      }
    }

    return true;
  }
}

registerProcessor('lexitype-pcm-processor', LexiTypePcmProcessor);
