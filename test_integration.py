#!/usr/bin/env python3
"""
SleepPlatform 集成测试脚本
验证后端 API + 前端集成是否正常工作

使用方式:
  python test_integration.py
"""

import requests
import json
import time
from datetime import datetime

class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    RESET = '\033[0m'

def print_header(text):
    print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BLUE}{text}{Colors.RESET}")
    print(f"{Colors.BLUE}{'='*60}{Colors.RESET}\n")

def print_ok(text):
    print(f"{Colors.GREEN}✓ {text}{Colors.RESET}")

def print_fail(text):
    print(f"{Colors.RED}✗ {text}{Colors.RESET}")

def print_info(text):
    print(f"{Colors.YELLOW}ℹ {text}{Colors.RESET}")

class IntegrationTester:
    def __init__(self, backend_url="http://localhost:8000"):
        self.backend_url = backend_url
        self.session_token = None
        self.user_id = None
        
    def test_health(self):
        """测试后端健康状态"""
        print_header("步骤 1: 验证后端连接")
        
        try:
            response = requests.get(f"{self.backend_url}/", timeout=5)
            if response.status_code == 200:
                data = response.json()
                print_ok(f"后端在线: {data.get('service', 'API Server')}")
                print_ok(f"支持的平台: {', '.join(data.get('platforms', []))}")
                return True
            else:
                print_fail(f"后端返回错误代码: {response.status_code}")
                return False
        except requests.exceptions.ConnectionError:
            print_fail(f"无法连接到后端: {self.backend_url}")
            print_info("请确保: python main.py 正在运行")
            return False
        except Exception as e:
            print_fail(f"连接错误: {e}")
            return False
    
    def test_individual_login(self):
        """测试个人登入"""
        print_header("步骤 2: 测试个人登入")
        
        payload = {
            "role": "individual",
            "platform": "sleep"
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/auth/login",
                json=payload,
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                self.session_token = data.get("session", {}).get("session_id")
                self.user_id = data.get("session", {}).get("user_id")
                
                print_ok(f"个人登入成功")
                print_info(f"用户ID: {self.user_id}")
                print_info(f"会话令牌: {self.session_token[:20]}...")
                return True
            else:
                print_fail(f"个人登入失败: {response.status_code}")
                print_fail(f"响应: {response.text}")
                return False
        except Exception as e:
            print_fail(f"个人登入异常: {e}")
            return False
    
    def test_org_login(self):
        """测试组织登入"""
        print_header("步骤 3: 测试组织登入")
        
        payload = {
            "type": "org",
            "org_code": "ABC123",
            "role": "member",
            "pin": "1111",
            "name": "测试成员",
            "platform": "sleep"
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/auth/login",
                json=payload,
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                self.session_token = data.get("session", {}).get("session_id")
                self.user_id = data.get("session", {}).get("user_id")
                
                print_ok(f"组织登入成功")
                print_info(f"用户ID: {self.user_id}")
                print_info(f"会话令牌: {self.session_token[:20]}...")
                return True
            else:
                print_fail(f"组织登入失败: {response.status_code}")
                print_fail(f"响应: {response.text}")
                return False
        except Exception as e:
            print_fail(f"组织登入异常: {e}")
            return False
    
    def test_assessment_submission(self):
        """测试评估提交"""
        print_header("步骤 4: 测试评估数据提交")
        
        if not self.session_token or not self.user_id:
            print_fail("没有有效的会话令牌，请先完成登入")
            return False
        
        payload = {
            "user_id": self.user_id,
            "profile": {
                "name": "测试用户",
                "age": 30,
                "gender": "male"
            },
            "sleep_scores": {"q1": 5, "q2": 4, "q3": 3, "q4": 4, "q5": 5, "q6": 3, "q7": 4},  # ISI 7个问题
            "pain_scores": {"q1": 3, "q2": 2, "q3": 3, "q4": 2, "q5": 3},                    # BPI 5个问题
            "work_scores": {"q1": 4, "q2": 3, "q3": 4}                                       # WQ 3个问题
        }
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/sleep/assessment",
                json=payload,
                headers={"Authorization": f"Bearer {self.session_token}"},
                timeout=5
            )
            
            if response.status_code == 201:
                data = response.json()
                report_id = data.get("report", {}).get("id")
                print_ok(f"评估提交成功")
                print_info(f"报告ID: {report_id}")
                return True
            else:
                print_fail(f"评估提交失败: {response.status_code}")
                print_fail(f"响应: {response.text}")
                return False
        except Exception as e:
            print_fail(f"评估提交异常: {e}")
            return False
    
    def test_report_list(self):
        """测试报告列表获取"""
        print_header("步骤 5: 测试获取报告列表")
        
        if not self.session_token or not self.user_id:
            print_fail("没有有效的会话令牌，请先完成登入")
            return False
        
        try:
            response = requests.get(
                f"{self.backend_url}/api/sleep/reports",
                params={"user_id": self.user_id},
                headers={"Authorization": f"Bearer {self.session_token}"},
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                reports = data.get("reports", [])
                print_ok(f"获取报告列表成功")
                print_info(f"找到 {len(reports)} 份报告")
                
                if reports:
                    for i, report in enumerate(reports[:3], 1):
                        print_info(f"  报告 {i}: ID={report.get('id')}, 创建于 {report.get('created_at')}")
                
                return True
            else:
                print_fail(f"获取报告列表失败: {response.status_code}")
                print_fail(f"响应: {response.text}")
                return False
        except Exception as e:
            print_fail(f"获取报告列表异常: {e}")
            return False
    
    def test_platform_switch(self):
        """测试平台切换"""
        print_header("步骤 6: 测试平台切换")
        
        if not self.session_token:
            print_fail("没有有效的会话令牌，请先完成登入")
            return False
        
        try:
            response = requests.post(
                f"{self.backend_url}/api/auth/switch-platform",
                params={
                    "user_id": self.user_id,
                    "from_platform": "sleep",
                    "to_platform": "schumann"
                },
                headers={"Authorization": f"Bearer {self.session_token}"},
                timeout=5
            )
            
            if response.status_code == 200:
                data = response.json()
                print_ok(f"平台切换成功")
                print_info(f"新平台: {data.get('session', {}).get('platform')}")
                return True
            else:
                print_fail(f"平台切换失败: {response.status_code}")
                print_fail(f"响应: {response.text}")
                return False
        except Exception as e:
            print_fail(f"平台切换异常: {e}")
            return False
    
    def run_all_tests(self):
        """运行所有测试"""
        print(f"\n{Colors.BLUE}")
        print("╔════════════════════════════════════════╗")
        print("║  睡眠平台 - 前后端集成测试套件        ║")
        print("║  Sleep Platform Integration Test Suite ║")
        print(f"║  时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} {' '*6}║")
        print("╚════════════════════════════════════════╝")
        print(Colors.RESET)
        
        results = {
            "健康检查": self.test_health(),
            "个人登入": self.test_individual_login(),
            "组织登入": self.test_org_login(),
            "评估提交": self.test_assessment_submission(),
            "报告列表": self.test_report_list(),
            "平台切换": self.test_platform_switch(),
        }
        
        # 汇总结果
        print_header("测试结果汇总")
        
        passed = sum(1 for v in results.values() if v)
        total = len(results)
        
        for test_name, result in results.items():
            status = f"{Colors.GREEN}✓ 通过{Colors.RESET}" if result else f"{Colors.RED}✗ 失败{Colors.RESET}"
            print(f"  {test_name:<15} {status}")
        
        print()
        percentage = (passed / total) * 100
        if percentage == 100:
            print_ok(f"所有测试都通过了! ({passed}/{total})")
            print_info("✨ 前后端集成正常工作！")
        elif percentage >= 80:
            print_info(f"大部分测试通过了 ({passed}/{total}, {percentage:.0f}%)")
            print_info("💡 请检查失败的测试")
        else:
            print_fail(f"测试不全通过 ({passed}/{total}, {percentage:.0f}%)")
            print_info("⚠️  请检查后端配置和网络连接")
        
        print()
        return percentage

def main():
    """主函数"""
    tester = IntegrationTester()
    percentage = tester.run_all_tests()
    
    print(f"\n{Colors.BLUE}{'='*60}{Colors.RESET}")
    print(f"{Colors.BLUE}下一步:{Colors.RESET}")
    print("  1. 启动前端开发服务器: cd frontend && npm run dev")
    print("  2. 打开浏览器: http://localhost:3000")
    print("  3. 测试登入流程")
    print("  4. 提交评估数据")
    print("  5. 查看生成的报告")
    print(f"{Colors.BLUE}{'='*60}{Colors.RESET}\n")

if __name__ == "__main__":
    main()
