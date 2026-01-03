"""
PDF Processing module for Sezi.
Handles text extraction and parsing from PDF documents.
"""

from pypdf import PdfReader
import re
from dataclasses import dataclass
from typing import List, Tuple


@dataclass
class ProcessedDocument:
    """Represents a processed PDF document."""
    file_path: str
    file_name: str
    total_pages: int
    pages: List['ProcessedPage']
    
    def to_dict(self):
        return {
            "file_path": self.file_path,
            "file_name": self.file_name,
            "total_pages": self.total_pages,
            "pages": [page.to_dict() for page in self.pages]
        }


@dataclass 
class ProcessedPage:
    """Represents a processed page with its content."""
    page_number: int
    text: str
    words: List[str]
    sentences: List[str]
    
    def to_dict(self):
        return {
            "page_number": self.page_number,
            "text": self.text,
            "words": self.words,
            "sentences": self.sentences,
            "word_count": len(self.words),
            "sentence_count": len(self.sentences)
        }


def extract_text_from_pdf(file_path: str) -> ProcessedDocument:
    """
    Extract text from a PDF file and process it into words and sentences.
    
    Args:
        file_path: Path to the PDF file
        
    Returns:
        ProcessedDocument with all extracted content
    """
    reader = PdfReader(file_path)
    file_name = file_path.split("/")[-1].split("\\")[-1]
    
    pages = []
    
    for page_num, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        
        # Clean up the text
        text = clean_text(text)
        
        # Extract words and sentences
        words = extract_words(text)
        sentences = extract_sentences(text)
        
        processed_page = ProcessedPage(
            page_number=page_num + 1,
            text=text,
            words=words,
            sentences=sentences
        )
        pages.append(processed_page)
    
    return ProcessedDocument(
        file_path=file_path,
        file_name=file_name,
        total_pages=len(pages),
        pages=pages
    )


def clean_text(text: str) -> str:
    """Clean and normalize extracted text."""
    # Replace multiple whitespace with single space
    text = re.sub(r'\s+', ' ', text)
    
    # Remove leading/trailing whitespace
    text = text.strip()
    
    # Fix common PDF extraction issues
    # Rejoin hyphenated words at line breaks
    text = re.sub(r'(\w)-\s+(\w)', r'\1\2', text)
    
    return text


def extract_words(text: str) -> List[str]:
    """Extract individual words from text, preserving attached punctuation."""
    # Split on whitespace, keeping punctuation attached to words
    words = text.split()
    return [w for w in words if w.strip()]


def extract_sentences(text: str) -> List[str]:
    """Extract sentences from text."""
    if not text or not text.strip():
        return []
    
    # Common abbreviations that shouldn't end sentences
    abbreviations = {'Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Sr', 'Jr', 'vs', 'etc', 'e.g', 'i.e', 
                     'Inc', 'Ltd', 'Co', 'Corp', 'Jan', 'Feb', 'Mar', 'Apr', 'Jun', 'Jul',
                     'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'St', 'Ave', 'Blvd'}
    
    # First, protect abbreviations by replacing their periods temporarily
    protected_text = text
    for abbr in abbreviations:
        # Replace "Mr." with "Mr<PERIOD>" etc.
        protected_text = re.sub(rf'\b{re.escape(abbr)}\.', f'{abbr}<PERIOD>', protected_text)
    
    # Split on sentence-ending punctuation followed by space and capital letter or end
    # This pattern matches ., !, ? followed by whitespace
    sentences = re.split(r'[.!?]+\s+', protected_text)
    
    # Restore the protected periods and clean up
    result = []
    for s in sentences:
        s = s.replace('<PERIOD>', '.').strip()
        if s:
            result.append(s)
    
    # If no sentence breaks found, treat the whole text as one sentence
    if not result and text.strip():
        result = [text.strip()]
    
    return result


def get_bionic_word(word: str) -> Tuple[str, str]:
    """
    Split a word into highlighted and non-highlighted parts for bionic reading.
    The first portion (roughly 40-50%) is highlighted to guide the eye.
    
    Returns:
        Tuple of (highlighted_part, rest_of_word)
    """
    if not word:
        return ("", "")
    
    length = len(word)
    
    # Determine how much to highlight based on word length
    if length == 1:
        return (word, "")
    elif length == 2:
        return (word[0], word[1])
    elif length == 3:
        return (word[:2], word[2:])
    elif length <= 5:
        # Highlight about 40%
        highlight_len = max(1, int(length * 0.4))
        return (word[:highlight_len], word[highlight_len:])
    else:
        # For longer words, highlight more (about 50%)
        highlight_len = max(2, int(length * 0.5))
        return (word[:highlight_len], word[highlight_len:])


def process_text_for_bionic(text: str) -> List[dict]:
    """
    Process text and return bionic reading formatted data.
    
    Returns:
        List of dicts with 'highlighted' and 'rest' keys
    """
    words = extract_words(text)
    return [
        {
            "word": word,
            "highlighted": get_bionic_word(word)[0],
            "rest": get_bionic_word(word)[1]
        }
        for word in words
    ]


def get_document_stats(doc: ProcessedDocument) -> dict:
    """Get statistics about a processed document."""
    total_words = sum(len(page.words) for page in doc.pages)
    total_sentences = sum(len(page.sentences) for page in doc.pages)
    total_chars = sum(len(page.text) for page in doc.pages)
    
    # Estimate reading time at average reading speed (200-250 WPM)
    avg_reading_time_mins = total_words / 225
    
    return {
        "total_pages": doc.total_pages,
        "total_words": total_words,
        "total_sentences": total_sentences,
        "total_characters": total_chars,
        "estimated_reading_time_minutes": round(avg_reading_time_mins, 1)
    }
