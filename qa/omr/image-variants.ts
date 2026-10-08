import jpeg from "jpeg-js";

// Test-only controlled lighting transformation, never an original/old scan.
export function blueIllumination(dataUrl:string){
  const image=jpeg.decode(Buffer.from(dataUrl.split(",")[1],"base64"),{useTArray:true});
  for(let i=0;i<image.data.length;i+=4){
    image.data[i]=Math.round(image.data[i]*.62);
    image.data[i+1]=Math.round(image.data[i+1]*.72);
    image.data[i+2]=Math.round(image.data[i+2]*.85);
  }
  return `data:image/jpeg;base64,${Buffer.from(jpeg.encode(image,95).data).toString("base64")}`;
}
