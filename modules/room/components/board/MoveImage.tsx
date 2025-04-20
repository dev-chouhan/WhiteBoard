import { useEffect, useState, useRef } from "react";

import { motion, useMotionValue } from "framer-motion";
import { AiOutlineCheck, AiOutlineClose } from "react-icons/ai";

import { DEFAULT_MOVE } from "@/common/constants/defaultMove";
import { getPos } from "@/common/lib/getPos";
import { socket } from "@/common/lib/socket";

import { useBoardPosition } from "../../hooks/useBoardPosition";
import { useMoveImage } from "../../hooks/useMoveImage";
import { useRefs } from "../../hooks/useRefs";

const MoveImage = () => {
  const { canvasRef } = useRefs();
  const { x, y } = useBoardPosition();
  const { moveImage, setMoveImage } = useMoveImage();
  const imageRef = useRef<HTMLImageElement>(null);

  const imageX = useMotionValue(moveImage.x || 50);
  const imageY = useMotionValue(moveImage.y || 50);
  const [imageWidth, setImageWidth] = useState(200);
  const [imageHeight, setImageHeight] = useState(200);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<"nw" | "ne" | "sw" | "se" | null>(null);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [fixedCorners, setFixedCorners] = useState({
    opposite: { x: 0, y: 0 },
    xAxis: { x: 0, y: 0 },
    yAxis: { x: 0, y: 0 }
  });
  const [viewportSize, setViewportSize] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1850,
    height: typeof window !== 'undefined' ? window.innerHeight : 900
  });

  useEffect(() => {
    const handleResize = () => {
      setViewportSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (moveImage.x) imageX.set(moveImage.x);
    else imageX.set(50);
    if (moveImage.y) imageY.set(moveImage.y);
    else imageY.set(50);
  }, [imageX, imageY, moveImage.x, moveImage.y]);

  useEffect(() => {
    if (imageRef.current) {
      imageRef.current.onload = () => {
        const naturalWidth = imageRef.current?.naturalWidth || 1;
        const naturalHeight = imageRef.current?.naturalHeight || 1;
        const ratio = naturalWidth / naturalHeight;
        setAspectRatio(ratio);
        
        // Set initial size based on viewport dimensions
        const maxWidth = viewportSize.width * 0.3; // 30% of viewport width
        const maxHeight = viewportSize.height * 0.3; // 30% of viewport height
        
        if (ratio > 1) {
          // Landscape image
          setImageWidth(maxWidth);
          setImageHeight(maxWidth / ratio);
        } else {
          // Portrait image
          setImageHeight(maxHeight);
          setImageWidth(maxHeight * ratio);
        }
      };
    }
  }, [moveImage.base64, viewportSize]);

  const handlePlaceImage = () => {
    const [finalX, finalY] = [getPos(imageX.get(), x), getPos(imageY.get(), y)];

    const move: Move = {
      ...DEFAULT_MOVE,
      img: { 
        base64: moveImage.base64,
        width: imageWidth,
        height: imageHeight
      },
      path: [[finalX, finalY]],
      options: {
        ...DEFAULT_MOVE.options,
        selection: null,
        shape: "image",
      },
    };

    socket.emit("draw", move);

    setMoveImage({ base64: "" });
    imageX.set(50);
    imageY.set(50);
    setImageWidth(200);
    setImageHeight(200);
  };

  const handleResizeStart = (handle: "nw" | "ne" | "sw" | "se") => {
    setIsResizing(true);
    setResizeHandle(handle);
    setStartPos({ x: imageX.get(), y: imageY.get() });
    
    // Set fixed corners based on the resize handle
    const currentX = imageX.get();
    const currentY = imageY.get();
    
    switch (handle) {
      case "nw":
        setFixedCorners({
          opposite: { x: currentX + imageWidth, y: currentY + imageHeight }, // SE
          xAxis: { x: currentX, y: currentY + imageHeight }, // SW
          yAxis: { x: currentX + imageWidth, y: currentY } // NE
        });
        break;
      case "ne":
        setFixedCorners({
          opposite: { x: currentX, y: currentY + imageHeight }, // SW
          xAxis: { x: currentX + imageWidth, y: currentY + imageHeight }, // SE
          yAxis: { x: currentX, y: currentY } // NW
        });
        break;
      case "sw":
        setFixedCorners({
          opposite: { x: currentX + imageWidth, y: currentY }, // NE
          xAxis: { x: currentX, y: currentY }, // NW
          yAxis: { x: currentX + imageWidth, y: currentY + imageHeight } // SE
        });
        break;
      case "se":
        setFixedCorners({
          opposite: { x: currentX, y: currentY }, // NW
          xAxis: { x: currentX, y: currentY + imageHeight }, // SW
          yAxis: { x: currentX + imageWidth, y: currentY } // NE
        });
        break;
    }
  };

  const handleResize = (e: React.MouseEvent) => {
    if (!isResizing || !resizeHandle) return;

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    let newWidth = imageWidth;
    let newHeight = imageHeight;
    let newX = imageX.get();
    let newY = imageY.get();

    switch (resizeHandle) {
      case "nw":
        // For NW corner, fix SE corner and constrain NE to y-axis and SW to x-axis
        newWidth = fixedCorners.opposite.x - mouseX;
        newHeight = fixedCorners.opposite.y - mouseY;
        if (newWidth > 20 && newHeight > 20) {
          if (e.shiftKey) {
            const ratio = newWidth / newHeight;
            if (ratio > aspectRatio) {
              newHeight = newWidth / aspectRatio;
            } else {
              newWidth = newHeight * aspectRatio;
            }
          }
          setImageWidth(newWidth);
          setImageHeight(newHeight);
          imageX.set(mouseX);
          imageY.set(mouseY);
        }
        break;

      case "ne":
        // For NE corner, fix SW corner and constrain NW to y-axis and SE to x-axis
        newWidth = mouseX - fixedCorners.opposite.x;
        newHeight = fixedCorners.opposite.y - mouseY;
        if (newWidth > 20 && newHeight > 20) {
          if (e.shiftKey) {
            const ratio = newWidth / newHeight;
            if (ratio > aspectRatio) {
              newHeight = newWidth / aspectRatio;
            } else {
              newWidth = newHeight * aspectRatio;
            }
          }
          setImageWidth(newWidth);
          setImageHeight(newHeight);
          imageY.set(mouseY);
          // Keep x-axis corner fixed on x-axis
          imageX.set(fixedCorners.xAxis.x);
        }
        break;

      case "sw":
        // For SW corner, fix NE corner and constrain NW to x-axis and SE to y-axis
        newWidth = fixedCorners.opposite.x - mouseX;
        newHeight = mouseY - fixedCorners.opposite.y;
        if (newWidth > 20 && newHeight > 20) {
          if (e.shiftKey) {
            const ratio = newWidth / newHeight;
            if (ratio > aspectRatio) {
              newHeight = newWidth / aspectRatio;
            } else {
              newWidth = newHeight * aspectRatio;
            }
          }
          setImageWidth(newWidth);
          setImageHeight(newHeight);
          imageX.set(mouseX);
          // Keep y-axis corner fixed on y-axis
          imageY.set(fixedCorners.yAxis.y);
        }
        break;

      case "se":
        // For SE corner, fix NW corner and constrain NE to y-axis and SW to x-axis
        newWidth = mouseX - fixedCorners.opposite.x;
        newHeight = mouseY - fixedCorners.opposite.y;
        if (newWidth > 20 && newHeight > 20) {
          if (e.shiftKey) {
            const ratio = newWidth / newHeight;
            if (ratio > aspectRatio) {
              newHeight = newWidth / aspectRatio;
            } else {
              newWidth = newHeight * aspectRatio;
            }
          }
          setImageWidth(newWidth);
          setImageHeight(newHeight);
          // Keep x-axis corner fixed on x-axis
          imageX.set(fixedCorners.xAxis.x);
          // Keep y-axis corner fixed on y-axis
          imageY.set(fixedCorners.yAxis.y);
        }
        break;
    }
  };

  if (!moveImage.base64) return null;

  return (
    <>
      <motion.div
        drag
        dragConstraints={canvasRef}
        dragElastic={0}
        dragTransition={{ power: 0.03, timeConstant: 50 }}
        className="absolute top-0 z-20 cursor-grab"
        style={{ x: imageX, y: imageY }}
        onMouseMove={handleResize}
        onMouseUp={() => {
          setIsResizing(false);
          setResizeHandle(null);
        }}
      >
        <div className="absolute bottom-full mb-2 flex gap-3">
          <button
            className="rounded-full bg-gray-200 p-2"
            onClick={handlePlaceImage}
          >
            <AiOutlineCheck />
          </button>
          <button
            className="rounded-full bg-gray-200 p-2"
            onClick={() => setMoveImage({ base64: "" })}
          >
            <AiOutlineClose />
          </button>
        </div>
        <div className="relative">
          <img
            ref={imageRef}
            className="pointer-events-none"
            alt="image to place"
            src={moveImage.base64}
            style={{ width: imageWidth, height: imageHeight }}
          />
          {/* Resize handles */}
          <div
            className="absolute -top-2 -left-2 h-4 w-4 cursor-nw-resize bg-white border-2 border-gray-800 rounded-full"
            onMouseDown={() => handleResizeStart("nw")}
          />
          {/* Invisible resize areas for other corners */}
          <div
            className="absolute -top-2 -right-2 h-4 w-4 cursor-ne-resize"
            onMouseDown={() => handleResizeStart("ne")}
          />
          <div
            className="absolute -bottom-2 -left-2 h-4 w-4 cursor-sw-resize"
            onMouseDown={() => handleResizeStart("sw")}
          />
          <div
            className="absolute -bottom-2 -right-2 h-4 w-4 cursor-se-resize"
            onMouseDown={() => handleResizeStart("se")}
          />
        </div>
      </motion.div>
    </>
  );
};

export default MoveImage;
