from PIL import Image, ImageDraw
from pathlib import Path
from pypdf import PdfReader
p=Path(__file__).parent
files=sorted(p.glob('verified-*.png'))
for start in range(0,len(files),8):
    canvas=Image.new('RGB',(1400,2040),'#d8dfe5')
    for j,f in enumerate(files[start:start+8]):
        im=Image.open(f); im.thumbnail((680,475))
        x=(j%2)*700+(700-im.width)//2; y=(j//2)*510+25
        canvas.paste(im,(x,y))
        ImageDraw.Draw(canvas).text((j%2*700+12,j//2*510+8),f.stem,fill='black')
    canvas.save(p/('contact-'+str(start//8+1)+'.png'))
reader=PdfReader(p.parents[1]/'output/pdf/my-web-app-v2-stages-1-to-5.pdf')
for i,page in enumerate(reader.pages):
    t=page.extract_text()
    print(i+1,len(t),t.splitlines()[2:4])
