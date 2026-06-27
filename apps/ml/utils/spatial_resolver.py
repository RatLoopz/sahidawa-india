import numpy as np
from sklearn.cluster import DBSCAN

class SpatialLayoutResolver:
    def __init__(self, row_overlap_epsilon=0.3, min_column_samples=1):
        """
        Args:
            row_overlap_epsilon (float): Percentage of vertical overlap allowed to group tokens into a single row.
            min_column_samples (int): Minimum points to form a column cluster via DBSCAN.
        """
        self.row_overlap_epsilon = row_overlap_epsilon
        self.min_column_samples = min_column_samples

    def _correct_skew(self, bboxes, min_skew_deg=0.5):
        if len(bboxes) < 2:
            return bboxes

        # Compute centroids
        cx = (bboxes[:, 0] + bboxes[:, 2]) / 2
        cy = (bboxes[:, 1] + bboxes[:, 3]) / 2

        # Estimate skew angle
        slope, _ = np.polyfit(cx, cy, 1)
        angle = np.arctan(slope)

        # Skip tiny rotations
        if np.abs(np.degrees(angle)) < min_skew_deg:
            return bboxes

        cos_theta = np.cos(-angle)
        sin_theta = np.sin(-angle)

        rotation = np.array([
            [cos_theta, -sin_theta],
            [sin_theta,  cos_theta]
        ], dtype=np.float32)

        # Image center
        center = np.array([np.mean(cx), np.mean(cy)], dtype=np.float32)

        # Four corners of every box
        corners = np.stack([
            bboxes[:, [0, 1]],
            np.stack([bboxes[:, 2], bboxes[:, 1]], axis=1),
            bboxes[:, [2, 3]],
            np.stack([bboxes[:, 0], bboxes[:, 3]], axis=1)
        ], axis=1)

        # Rotate all corners (vectorized)
        rotated = (corners - center) @ rotation.T + center

        xmin = rotated[:, :, 0].min(axis=1)
        ymin = rotated[:, :, 1].min(axis=1)
        xmax = rotated[:, :, 0].max(axis=1)
        ymax = rotated[:, :, 1].max(axis=1)

        return np.stack([xmin, ymin, xmax, ymax], axis=1)

    def resolve_layout(self, ocr_tokens):
        """
        Args:
            ocr_tokens (list): List of dicts representing raw OCR outputs:
                               [{"text": "Amlodipine", "bbox": [xmin, ymin, xmax, ymax]}, ...]
        Returns:
            str: A structured Markdown table representing the logical 2D layout.
        """
        if not ocr_tokens:
            return ""

        # 1. Extrapolate coordinates into a structured NumPy Matrix
        bboxes = np.array([t["bbox"] for t in ocr_tokens], dtype=np.float32)
        texts = np.array([t["text"] for t in ocr_tokens])

        # Preprocess: Correct document skew before layout analysis
        bboxes = self._correct_skew(bboxes)

        # 2. Step 1: Horizontal Projection Profiling / Row Segmentation
        y_sort_indices = np.argsort(bboxes[:, 1])
        bboxes = bboxes[y_sort_indices]
        texts = texts[y_sort_indices]

        rows = []
        current_row_indices = []
        
        for i in range(len(bboxes)):
            if not current_row_indices:
                current_row_indices.append(i)
                continue
            
            current_ymin = np.min(bboxes[current_row_indices, 1])
            current_ymax = np.max(bboxes[current_row_indices, 3])
            current_height = current_ymax - current_ymin
            
            token_ymin = bboxes[i, 1]
            token_ymax = bboxes[i, 3]
            
            overlap = min(current_ymax, token_ymax) - max(current_ymin, token_ymin)
            
            if overlap > (current_height * self.row_overlap_epsilon) or token_ymin <= current_ymax:
                current_row_indices.append(i)
            else:
                rows.append(current_row_indices)
                current_row_indices = [i]
        if current_row_indices:
            rows.append(current_row_indices)

        # 3. Step 2 & 3: Column Identification (DBSCAN) & Grid Reconstruction
        markdown_lines = []
        
        for row_idx in rows:
            row_bboxes = bboxes[row_idx]
            row_texts = texts[row_idx]
            
            x_features = row_bboxes[:, 0].reshape(-1, 1)
            
            widths = row_bboxes[:, 2] - row_bboxes[:, 0]
            median_width = np.median(widths) if len(widths) > 0 else 10
            adaptive_eps = median_width * 1.5 

            clustering = DBSCAN(eps=adaptive_eps, min_samples=self.min_column_samples).fit(x_features)
            labels = clustering.labels_
            
            unique_labels = np.unique(labels)
            column_groups = []
            
            for label in unique_labels:
                label_indices = np.where(labels == label)[0]
                sub_sort = np.argsort(row_bboxes[label_indices, 0])
                sorted_label_indices = label_indices[sub_sort]
                
                mean_x = np.mean(row_bboxes[sorted_label_indices, 0])
                combined_text = " ".join(row_texts[sorted_label_indices])
                column_groups.append((mean_x, combined_text))
            
            column_groups.sort(key=lambda item: item[0])
            
            row_string = "| " + " | ".join([text for _, text in column_groups]) + " |"
            markdown_lines.append(row_string)

        return "\n".join(markdown_lines)

if __name__ == "__main__":
    print("🚀 Initializing Test Execution Pipeline...")
    
    mock_ocr_payload = [
        {"text": "Amlodipine 5mg", "bbox": [10, 100, 150, 130]},
        {"text": "Take 1 tab at night", "bbox": [400, 175, 600, 205]},

        {"text": "Paracetamol 650mg", "bbox": [25, 200, 165, 230]},
        {"text": "S.O.S if fever high", "bbox": [415, 275, 615, 305]},
    ]
    
    resolver = SpatialLayoutResolver()
    structured_output = resolver.resolve_layout(mock_ocr_payload)
    
    print("\n--- RECONSTRUCTED MATRIX OUTPUT ---")
    print(structured_output)
    print("-----------------------------------\n")