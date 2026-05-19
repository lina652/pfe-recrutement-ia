"""
Emotion detection service using DeepFace for facial emotion analysis.
"""
import logging
from pathlib import Path
from typing import List, Dict
import cv2
import numpy as np
from deepface import DeepFace

logger = logging.getLogger(__name__)


class EmotionService:
    """
    Analyzes facial emotions from video frames using DeepFace.
    """
    
    def __init__(self):
        self.emotions = ["angry", "disgust", "fear", "happy", "neutral", "sad", "surprise"]
        self.models = ['VGG-Face', 'Facenet512', 'OpenFace', 'DeepFace', 'ArcFace']
    
    def extract_frames(self, video_path: str, interval_sec: int = 2) -> List[str]:
        """
        Extract frames from video file at regular intervals.
        
        Args:
            video_path: Path to video file (.webm, .mp4, etc.)
            interval_sec: Extract frame every N seconds
        
        Returns:
            List of frame file paths saved to disk
        """
        try:
            video = cv2.VideoCapture(video_path)
            if not video.isOpened():
                logger.error(f"Cannot open video: {video_path}")
                raise ValueError(f"Cannot open video: {video_path}")
            
            fps = video.get(cv2.CAP_PROP_FPS)
            frame_interval = int(fps * interval_sec)
            frame_count = 0
            extracted_frames = []
            
            # Create temp directory for frames
            frames_dir = Path("/tmp/interview_frames")
            frames_dir.mkdir(exist_ok=True)
            
            while True:
                ret, frame = video.read()
                if not ret:
                    break
                
                if frame_count % frame_interval == 0:
                    frame_path = frames_dir / f"frame_{frame_count:06d}.jpg"
                    cv2.imwrite(str(frame_path), frame)
                    extracted_frames.append(str(frame_path))
                
                frame_count += 1
            
            video.release()
            logger.info(f"Extracted {len(extracted_frames)} frames from {video_path}")
            return extracted_frames
        
        except Exception as e:
            logger.error(f"Frame extraction error: {str(e)}")
            raise
    
    def analyze_frame(self, frame_path: str) -> Dict:
        """
        Analyze emotions in a single frame.
        
        Args:
            frame_path: Path to image file
        
        Returns:
            {
                "emotions": {emotion_name: confidence_score, ...},
                "dominant_emotion": str,
                "engagement": float (0-1, based on dominant emotion)
            }
        """
        try:
            result = DeepFace.analyze(
                img_path=frame_path,
                actions=['emotion'],
                enforce_detection=False
            )
            
            if not result:
                logger.warning(f"No face detected in {frame_path}")
                return {
                    "emotions": {e: 0.0 for e in self.emotions},
                    "dominant_emotion": None,
                    "engagement": 0.0
                }
            
            # DeepFace returns list of results (one per detected face)
            face_result = result[0]
            emotions = face_result.get('emotion', {})
            
            # Normalize emotions to 0-1 range
            total = sum(emotions.values())
            if total > 0:
                normalized_emotions = {k: v / total for k, v in emotions.items()}
            else:
                normalized_emotions = {e: 0.0 for e in self.emotions}
            
            dominant = max(normalized_emotions.items(), key=lambda x: x[1])[0]
            
            # Engagement score: 1.0 for happy/surprise, 0.5 for neutral, 0.0 for negative
            engagement_map = {
                "happy": 1.0,
                "surprise": 0.9,
                "neutral": 0.5,
                "sad": 0.2,
                "fear": 0.1,
                "angry": 0.0,
                "disgust": 0.0
            }
            engagement = engagement_map.get(dominant, 0.5)
            
            return {
                "emotions": normalized_emotions,
                "dominant_emotion": dominant,
                "engagement": engagement
            }
        
        except Exception as e:
            logger.error(f"Emotion analysis error for {frame_path}: {str(e)}")
            return {
                "emotions": {e: 0.0 for e in self.emotions},
                "dominant_emotion": None,
                "engagement": 0.0
            }
    
    def analyze_facial_emotions(self, frame_paths: List[str]) -> Dict:
        """Analyse rigoureuse : rejette frames noires, fiabilité du signal."""
        emotions_sum = {e: 0.0 for e in self.emotions}
        count = 0
        rejected_black = 0
        rejected_no_face = 0

        for fp in frame_paths:
            img = cv2.imread(fp)
            if img is None:
                continue
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            if gray.mean() < 15 or gray.std() < 5:
                rejected_black += 1
                continue
            try:
                result = DeepFace.analyze(
                    img_path=fp,
                    actions=["emotion"],
                    enforce_detection=True,
                    detector_backend="opencv",
                    silent=True,
                )
                if isinstance(result, list):
                    result = result[0]
                for k, v in result.get("emotion", {}).items():
                    if k in emotions_sum:
                        emotions_sum[k] += float(v)
                count += 1
            except Exception:
                rejected_no_face += 1

        total = len(frame_paths)
        if count == 0:
            return {
                "aggregate_emotions": {},
                "emotion_distribution": {},
                "dominant_emotion": "no_face_detected",
                "engagement_score": 0.0,
                "frames_analyzed": total,
                "frames_with_face": 0,
                "analyzed_frames": 0,
                "rejected_black": rejected_black,
                "rejected_no_face": rejected_no_face,
                "signal_reliability": "low",
                "dominant_confidence": 0.0,
            }

        avg = {k: round(float(v / count), 2) for k, v in emotions_sum.items()}
        dominant = max(avg, key=avg.get)
        dominant_pct = avg[dominant]
        reliability = "high" if dominant_pct >= 50 else ("medium" if dominant_pct >= 35 else "low")

        engagement_map = {
            "happy": 1.0,
            "surprise": 0.9,
            "neutral": 0.5,
            "sad": 0.2,
            "fear": 0.1,
            "angry": 0.0,
            "disgust": 0.0,
        }
        engagement = engagement_map.get(dominant, 0.5)

        norm_aggregate = {k: v / 100.0 for k, v in avg.items()}
        return {
            "aggregate_emotions": norm_aggregate,
            "emotion_distribution": avg,
            "dominant_emotion": dominant,
            "engagement_score": engagement,
            "frames_analyzed": total,
            "frames_with_face": count,
            "analyzed_frames": count,
            "rejected_black": rejected_black,
            "rejected_no_face": rejected_no_face,
            "signal_reliability": reliability,
            "dominant_confidence": dominant_pct,
        }

    def analyze_frames(self, frame_paths: List[str]) -> Dict:
        """
        Analyze emotions across multiple frames and aggregate results.
        
        Args:
            frame_paths: List of image file paths
        
        Returns:
            {
                "aggregate_emotions": {emotion: avg_score, ...},
                "dominant_emotion": str,
                "engagement_score": float,
                "frame_count": int
            }
        """
        if not frame_paths:
            logger.warning("No frames provided for emotion analysis")
            return {
                "aggregate_emotions": {e: 0.0 for e in self.emotions},
                "dominant_emotion": None,
                "engagement_score": 0.0,
                "frame_count": 0
            }
        
        # Analyze all frames
        results = []
        for frame_path in frame_paths:
            result = self.analyze_frame(frame_path)
            if result["dominant_emotion"]:
                results.append(result)
        
        if not results:
            logger.warning("No faces detected in any frames")
            return {
                "aggregate_emotions": {e: 0.0 for e in self.emotions},
                "dominant_emotion": None,
                "engagement_score": 0.0,
                "frame_count": len(frame_paths)
            }
        
        # Aggregate emotions
        aggregate = {e: 0.0 for e in self.emotions}
        total_engagement = 0.0
        
        for result in results:
            for emotion, score in result["emotions"].items():
                aggregate[emotion] += score
            total_engagement += result["engagement"]
        
        # Average
        for emotion in aggregate:
            aggregate[emotion] /= len(results)
        
        avg_engagement = total_engagement / len(results)
        dominant = max(aggregate.items(), key=lambda x: x[1])[0]
        
        logger.info(f"Analyzed {len(results)}/{len(frame_paths)} frames. Dominant emotion: {dominant}")
        
        return {
            "aggregate_emotions": aggregate,
            "dominant_emotion": dominant,
            "engagement_score": avg_engagement,
            "frame_count": len(frame_paths),
            "analyzed_frames": len(results)
        }


# Singleton instance
_emotion_service = None


def get_emotion_service() -> EmotionService:
    global _emotion_service
    if _emotion_service is None:
        _emotion_service = EmotionService()
    return _emotion_service
