using System;
using System.Collections.Generic;

namespace ExamApp.Models
{
    public class ExamSession
    {
        public int Id { get; set; }
        public int ExamId { get; set; }
        public DateTime Date { get; set; } = DateTime.Today;
        public string? Location { get; set; }
        public string? Notes { get; set; }

        public Exam? Exam { get; set; }
        public ICollection<ParticipantResult> ParticipantResults { get; set; } = new List<ParticipantResult>();
    }
}
