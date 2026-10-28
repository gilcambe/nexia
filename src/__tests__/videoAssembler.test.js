import { assembleVideo } from '../services/videoAssembler';
import { createFFmpeg } from '@ffmpeg/ffmpeg';

jest.mock('@ffmpeg/ffmpeg', () => {
  const mockFFmpeg = {
    isLoaded: jest.fn(),
    load: jest.fn(),
    FS: {
      writeFile: jest.fn(),
      readFile: jest.fn(() => new Uint8Array([0, 1, 2, 3, 4, 5])),
    },
    run: jest.fn(),
  };

  return {
    createFFmpeg: jest.fn(() => mockFFmpeg),
    fetchFile: jest.fn((file) => file),
  };
});

describe('videoAssembler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should assemble a video from images, audio, and subtitles', async () => {
    const mockImages = ['image1.png', 'image2.png', 'image3.png'];
    const mockAudio = 'audio.mp3';
    const mockSrt = '1\n00:00:00,000 --> 00:00:05,000\nHello, world!\n\n';

    const result = await assembleVideo({ images: mockImages, audio: mockAudio, srt: mockSrt });

    expect(createFFmpeg).toHaveBeenCalledWith({ log: true });
    expect(ffmpeg.isLoaded).toHaveBeenCalled();
    expect(ffmpeg.load).toHaveBeenCalled();
    expect(ffmpeg.FS.writeFile).toHaveBeenCalledTimes(6); // 3 images + 1 audio + 1 subtitles + 3 intermediate files
    expect(ffmpeg.run).toHaveBeenCalledTimes(3); // 1 for video creation + 1 for audio addition + 1 for subtitles addition
    expect(result).toBeInstanceOf(Blob);
    expect(result.type).toBe('video/mp4');
  });

  it('should show progress during video assembly', async () => {
    const mockImages = ['image1.png', 'image2.png', 'image3.png'];
    const mockAudio = 'audio.mp3';
    const mockSrt = '1\n00:00:00,000 --> 00:00:05,000\nHello, world!\n\n';

    const progressCallback = jest.fn();
    const result = await assembleVideo({ images: mockImages, audio: mockAudio, srt: mockSrt }, progressCallback);

    expect(progressCallback).toHaveBeenCalled();
    expect(result).toBeInstanceOf(Blob);
  });
});
