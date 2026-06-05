using System;
using System.Collections.Generic;

namespace ExamApp.Models
{
    public class Exam
    {
        public int Id { get; set; }
        public string Title { get; set; } = string.Empty;
        public string? Description { get; set; }
        public int DurationMinutes { get; set; } = 90;
        public DateTime CreatedAt { get; set; } = DateTime.Now;

        public ICollection<ExamQuestion> ExamQuestions { get; set; } = new List<ExamQuestion>();
        public ICollection<ExamSession> Sessions { get; set; } = new List<ExamSession>();
    }
}
