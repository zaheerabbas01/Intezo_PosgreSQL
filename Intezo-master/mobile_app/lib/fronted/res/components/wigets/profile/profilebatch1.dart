import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

// class Profile_batch1 extends StatelessWidget {
//   const Profile_batch1({
//     super.key,
//     required this.height,
//     required this.width,
//   });
//
//   final double height;
//   final double width;
//
//   @override
//   Widget build(BuildContext context) {
//     return Stack(
//       children: [
//         Padding(
//           padding: const EdgeInsets.only(left: 15,right: 15,top: 70),
//           child: Container(
//             height: height * 0.5,
//             decoration: BoxDecoration(
//                 color: Colors.black87,
//                 borderRadius: BorderRadius.circular(4.5)
//             ),
//             child: Align(
//               alignment: Alignment.center,
//               child: Column(
//                 mainAxisAlignment: MainAxisAlignment.start,
//                 children: [
//                   Align(
//                       alignment: Alignment.topLeft,
//                       child: Padding(
//                         padding: const EdgeInsets.only(left: 10,top: 32,right: 20),
//                         child: Column(
//                           crossAxisAlignment: CrossAxisAlignment.start,
//                           children: [
//                             Row(
//                               mainAxisAlignment: MainAxisAlignment.spaceBetween,
//                               children: [
//                                 Text("Qabool Mohammed", style: TextStyle(color: Colors.white,fontWeight: FontWeight.bold,letterSpacing: 0.5),),
//                                 Text("03113309644",style: TextStyle(color: Colors.white,fontWeight: FontWeight.bold,letterSpacing: 0.8),)
//                               ],
//                             ),
//                             Divider(),
//                             Row(
//                               children: [
//                                 Text("Age: 19", style: TextStyle(color: Colors.white,fontWeight: FontWeight.bold,letterSpacing: 0.5),),
//                                 Spacer(),
//                                 Text("Gender: male", style: TextStyle(color: Colors.white,fontWeight: FontWeight.bold,letterSpacing: 0.5),),
//                               ],
//                             ),
//                           ],
//                         ),
//                       )),
//                 ],
//               ),
//             ),
//           ),
//         ),
//         Align(
//             alignment: Alignment.center,
//             heightFactor: 1.7,
//             child:
//             SizedBox(
//               height: height * 0.19,
//               width: width * 0.19,
//               child: CircleAvatar(
//                 backgroundImage: AssetImage("assets/images/img_1.png"),
//               ),
//             )
//         ),
//       ],
//     );
//   }
// }

// Update your Profile_batch1 widget
class Profile_batch1 extends StatelessWidget {
  const Profile_batch1({
    super.key,
    required this.height,
    required this.width,
    required this.patientName,
    required this.patientPhone,
  });

  final double height;
  final double width;
  final String patientName;
  final String patientPhone;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 15,right: 15,top: 70),
          child: Container(
            height: height * 0.4, // Reduced height since we have less data
            decoration: BoxDecoration(
                color: Colors.black87,
                borderRadius: BorderRadius.circular(4.5)
            ),
            child: Align(
              alignment: Alignment.center,
              child: Column(
                mainAxisAlignment: MainAxisAlignment.start,
                children: [
                  Align(
                      alignment: Alignment.topLeft,
                      child: Padding(
                        padding: const EdgeInsets.only(left: 10,top: 32,right: 20),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(patientName, style: TextStyle(color: Colors.white,fontWeight: FontWeight.bold,letterSpacing: 0.5),),
                                Text(patientPhone, style: TextStyle(color: Colors.white,fontWeight: FontWeight.bold,letterSpacing: 0.8),)
                              ],
                            ),
                            Divider(color: Colors.white54),
                            // Removed age and gender since they're not in the API response
                            Text("Phone: $patientPhone", style: TextStyle(color: Colors.white70,fontWeight: FontWeight.w500,letterSpacing: 0.5),),
                            SizedBox(height: 8),
                            Text("Member since: Registered user", style: TextStyle(color: Colors.white70,fontSize: 12),),
                          ],
                        ),
                      )),
                ],
              ),
            ),
          ),
        ),
        Align(
            alignment: Alignment.center,
            heightFactor: 1.7,
            child:
            SizedBox(
              height: height * 0.19,
              width: width * 0.19,
              child: CircleAvatar(
                backgroundColor: Colors.blue,
                child: Text(
                  patientName.isNotEmpty ? patientName[0].toUpperCase() : 'U',
                  style: TextStyle(fontSize: 24, color: Colors.white, fontWeight: FontWeight.bold),
                ),
              ),
            )
        ),
      ],
    );
  }
}