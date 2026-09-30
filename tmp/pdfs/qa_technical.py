from pathlib import Path
from PIL import Image,ImageDraw
from pypdf import PdfReader
import pdfplumber,json,zipfile,hashlib
p=Path(__file__).parent
root=p.parents[1]
pdf=root/'output/pdf/my-web-app-v2-technical-manual-stages-1-to-5.pdf'
reader=PdfReader(pdf)
pages=[]
for i,page in enumerate(reader.pages):
    t=page.extract_text() or ''
    if len(t)<180: print('Sparse page',i+1,len(t))
    if any(x in t for x in ['19. Technical edition:', '20. Runtime architecture','21. React component','22. HTTP pipeline','23. Authentication &','24. Database design','25. Validation,','26. Test architecture','27. Complete source-code']):
        pages.append(i+1)
print('Technical chapter pages',pages)
bad=[]
with pdfplumber.open(pdf) as doc:
    for i,page in enumerate(doc.pages):
        for c in page.chars:
            if c['x0']<55 or c['x1']>page.width-54 or c['top']<20 or c['bottom']>page.height-20:
                bad.append((i+1,c['text'],round(c['x0'],1),round(c['x1'],1)))
print('Out of bounds characters',bad[:20],'count',len(bad))
zpath=root/'output/pdf/my-web-app-v2-stage5-source.zip'
with zipfile.ZipFile(zpath) as z:
    m=json.loads(z.read('SNAPSHOT-MANIFEST.json'))
    for name,digest in m['files'].items(): assert hashlib.sha256(z.read('my-web-app-v2/'+name)).hexdigest()==digest
    print('Archive verified',len(m['files']),'files')
files=sorted(p.glob('technical-final-*.png'))
for start in range(0,len(files),20):
    canvas=Image.new('RGB',(1400,2000),'#d8dfe5')
    for j,f in enumerate(files[start:start+20]):
        im=Image.open(f); im.thumbnail((340,370))
        x=(j%4)*350+(350-im.width)//2; y=(j//4)*400+22
        canvas.paste(im,(x,y))
        ImageDraw.Draw(canvas).text((j%4*350+10,j//4*400+5),f.stem,fill='black')
    canvas.save(p/('tech-contact-'+str(start//20+1)+'.png'))
print('Contact sheets', (len(files)+19)//20)
