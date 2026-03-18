import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const cutFile = formData.get("cut") as File | null;
    const clothFile = formData.get("cloth") as File | null;

    if (!cutFile || !clothFile) {
      return NextResponse.json(
        { error: "Both the silhouette image (cut) and fabric texture (cloth) are required" },
        { status: 400 }
      );
    }

    // Convert standard uploads to base64
    const cutBuffer = Buffer.from(await cutFile.arrayBuffer());
    const cutBase64 = cutBuffer.toString("base64");
    
    const clothBuffer = Buffer.from(await clothFile.arrayBuffer());
    const clothBase64 = clothBuffer.toString("base64");

    // Initialize the GoogleGenAI client
    // Expects GEMINI_API_KEY to be set in the environment (.env.local or production)
    const ai = new GoogleGenAI({});

    const promptText = "Replace ONLY the suit fabric with the uploaded texture. Preserve the suit's cut, fit, wrinkles, drape, lighting, shadows, and everything else in the photo — face, hair, background, buttons, stitching. Scale the pattern naturally to the garment's proportions.";

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-image-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: "Here is the silhouette/cut image:" },
            {
              inlineData: {
                data: cutBase64,
                mimeType: cutFile.type,
              }
            },
            { text: "Here is the new fabric/texture image to apply to the suit:" },
            {
              inlineData: {
                data: clothBase64,
                mimeType: clothFile.type,
              }
            },
            { text: promptText }
          ]
        }
      ],
      config: {
        responseModalities: ["TEXT", "IMAGE"],
      }
    });

    let base64Output = "";
    let mimeTypeOut = "image/png";

    // Extract the generated image from the response payload
    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content?.parts || [];
      const imagePart = parts.find(p => p.inlineData);
      
      if (imagePart && imagePart.inlineData) {
        base64Output = imagePart.inlineData.data || "";
        mimeTypeOut = imagePart.inlineData.mimeType || "image/png";
      }
    }

    if (!base64Output) {
      // Fallback in case of slightly different structure
      if ((response as any).generatedImages?.[0]) {
        base64Output = (response as any).generatedImages[0].image.imageBytes;
      } else {
        console.error("No image found in Gemini response", JSON.stringify(response, null, 2));
        throw new Error("No image was returned from the API.");
      }
    }

    return NextResponse.json({
      image: base64Output,
      mimeType: mimeTypeOut
    });
    
  } catch (error: any) {
    console.error("Atelier API error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to tailor garment" },
      { status: 500 }
    );
  }
}
